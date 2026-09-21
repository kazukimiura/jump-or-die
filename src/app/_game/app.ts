/**
 * app.ts — 画面遷移とゲームループの本体（React / DOM 非依存）
 *
 * 出典: GDD §1（コアループ）/ §8（死亡とリトライ）/ §10（記録）/ §11（画面構成）
 *       / §12-1（固定タイムステップ）/ §12-2（React の使いどころ）
 *       UIテキスト §4 / §5改訂 / §11 / §12 / §14 / §15
 *
 * 【設計の要点】
 * ・**本ファイルは DOM を一切触らない。** `requestAnimationFrame` も canvas も
 *   `GameClient.tsx` 側に置き、ここは「1フレーム進める純粋な状態機械」に徹する。
 *   これにより Node 上でそのまま通し検証できる（統合後の経路で S1 をクリアできるか等）。
 * ・**React の再レンダリングはゼロ。** 画面（TITLE / SELECT / RESULT を含む）はすべて
 *   canvas に描くため、DOM に反映すべき状態が存在しない。zustand も使っていない
 *   （GDD §12-2 は画面遷移を zustand に置くことを許しているが、DOM が state を
 *   参照しない以上、再レンダリングを発生させる利点が無いため採らなかった）。
 * ・`Date.now()` は**クリアタイムの計測にのみ**使う。ゲームロジックはすべて
 *   `stageFrame`（整数）で駆動する（GDD §12-6）。
 * ・`Math.random()` は**死亡メッセージの抽選（演出）にのみ**使う。
 */

import {
  DEATH_BURST,
  DEATH_HITSTOP,
  DEATH_RESET,
  GROUND_Y,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_SPRITE_H,
} from '@/lib/game/constants'
import { jumpHeightAt } from '@/lib/game/physics'
import {
  cameraX,
  createSim,
  playerWorldX,
  progressRatio,
  resetSim,
  resolveVisibleObjects,
  stepSim,
} from '@/lib/game/stageRuntime'
import type { ResolvedObj, SimState, StageDef } from '@/lib/game/types'
import { STAGES, getStage } from '@/data/stages'
import type {
  ExitPromptPhase,
  RenderObstacle,
  RenderObstacleKind,
  RenderPhase,
  RenderPit,
  RenderSelectEntry,
  RenderState,
} from '@/lib/render/renderState'
// 離脱導線のしきい値は描画層に一元化されている（透B・改訂R9）。二重管理しない
import { exitPromptPhaseOf, exitTapRegion, isExitTapAccepted } from '@/lib/render/draw'
import {
  MERCY_DEATHS,
  MARKS_KEEP,
  loadSave,
  stageRecord,
  writeSave,
  type SaveData,
  type StorageLike,
} from './save'
import { pickDeathMessage, type MessageContext } from './messages'

/* ============================================================================
 * 型
 * ========================================================================== */

export type AppPhase = 'TITLE' | 'SELECT' | 'READY' | 'PLAY' | 'HITSTOP' | 'BURST' | 'RESULT'

/** 効果音の種類（GDD §12-4）。鳴らすのは GameClient 側 */
export type SfxKind = 'JUMP' | 'LAND' | 'DEATH' | 'CLEAR' | 'BEST'

export interface AppDeps {
  /** localStorage 互換。無ければ null（記録は揮発する） */
  storage: StorageLike | null
  /** クリアタイムの計測**にのみ**使う */
  now: () => number
  /** 死亡メッセージの抽選**にのみ**使う（演出） */
  random: () => number
  /** タッチ端末なら TITLE の `SPACE / CLICK` を出さない */
  touchDevice: boolean
}

interface DeathState {
  /** 死亡フレームからの経過（0 始まり） */
  frame: number
  killerId: number | null
  /** 到達率 0–100（死亡地点で凍結） */
  reachPct: number
  newBest: boolean
}

interface BannerState {
  text: string
  /** この uiFrame まで表示する */
  until: number
}

export interface App {
  deps: AppDeps
  phase: AppPhase
  /** 起動からの通算フレーム。リセットしない（UI 点滅用） */
  uiFrame: number

  stage: StageDef
  sim: SimState
  save: SaveData

  death: DeathState | null
  readyMessage: string | null
  readyUnlock: readonly [string, string] | null
  banner: BannerState | null

  /** このステージの試行回数（保存前のメモリ値） */
  attempts: number
  /** 走り出した時刻（ms）。クリアタイムの計測用 */
  runStartMs: number
  /** RESULT に出す情報 */
  result: {
    timeMs: number
    newRecord: boolean
    firstClear: boolean
    deaths: number
    unlockedStageNo: number | null
    allClear: boolean
  } | null

  /** 死亡演出中に積まれたタップ。READY 到達と同時に走り出す（GDD §1-2） */
  pendingStart: boolean
  /** このフレームのシミュレーションに渡すジャンプ入力 */
  simTap: boolean
  /** 画面が隠れている等で停止中（GDD §12-1） */
  paused: boolean

  /** 直近に出した死亡メッセージ（新しい順・2本まで参照） */
  recentMessages: string[]
  /** 直近2回の死亡で優先抽選が発火したか（新しい順）。UIテキスト §19-2 のクールダウン */
  priorityHistory: boolean[]
  /** このセッションで一度でも死んだか */
  sessionDied: boolean
  /** 連続死亡回数（クリアでリセット） */
  consecutiveDeaths: number
  /** そのステージで初回入場かどうか（`STAGE n` バナーの出し分け） */
  freshEntry: boolean

  /**
   * 死亡後の `READY` に入ってからタップが無いフレーム数（GDD §14-16-3 アイドル顕在化）。
   * 90f で `← STAGES` がフェードインし始め、+18f で操作可能になる。
   * **`RUNNING` 中は一切参照しない。**
   */
  readyIdle: number
  /** 現在の整数倍スケール。44 CSS px の判定領域を論理座標へ換算するのに使う */
  viewScale: number

  /** 入力キュー。イベントハンドラはここに積むだけ（憲法4） */
  taps: { x: number; y: number }[]
  /** 鳴らすべき効果音。GameClient が毎フレーム回収する */
  sfx: SfxKind[]
}

/* ============================================================================
 * 定数
 * ========================================================================== */

/** 死亡 → 再開までの総フレーム数 = 6 + 11 + 1 = 18f = 300ms（GDD §8-1） */
export const DEATH_TOTAL_FRAMES = DEATH_HITSTOP + DEATH_BURST + DEATH_RESET
/** `STAGE n` の表示 0.8 秒（UIテキスト §4） */
const BANNER_STAGE_FRAMES = 48
/** `GO!` の表示 0.3 秒（UIテキスト §4） */
const BANNER_GO_FRAMES = 18

/** 当たり判定を持つ画面領域（論理座標 320×180） */
interface HitRect {
  x: number
  y: number
  w: number
  h: number
}
const inRect = (r: HitRect, x: number, y: number): boolean =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

/** TITLE の `STAGES` 枠（描画は 264,154,48,11。指の太さぶん広げる） */
const HIT_TITLE_STAGES: HitRect = { x: 258, y: 148, w: 62, h: 16 }
/** TITLE の `SFX` トグル */
const HIT_TITLE_SFX: HitRect = { x: 0, y: 164, w: 72, h: 16 }
/** TITLE の `FLASH` トグル */
const HIT_TITLE_FLASH: HitRect = { x: 240, y: 164, w: 80, h: 16 }
/** SELECT の戻り矢印（描画は 8,8） */
const HIT_SELECT_BACK: HitRect = { x: 0, y: 0, w: 48, h: 28 }
/** SELECT の枠（draw.ts の CARD_X / CARD_Y / CARD_W / CARD_H と一致させる） */
const HIT_SELECT_CARDS: readonly HitRect[] = [
  { x: 16, y: 56, w: 88, h: 72 },
  { x: 116, y: 56, w: 88, h: 72 },
  { x: 216, y: 56, w: 88, h: 72 },
]
/**
 * 死亡後 `READY` の離脱導線 `← STAGES`（GDD §14-16-3 アイドル顕在化）。
 * 描画は HUD 帯左端の 56×12px（`ST nn` と差し替え・透B担当）。
 */
/** RESULT の `RETRY`（描画は 8,168 F3X5） */
const HIT_RESULT_RETRY: HitRect = { x: 0, y: 158, w: 76, h: 22 }
/** RESULT の `STAGES`（描画は右寄せ 312,168） */
const HIT_RESULT_STAGES: HitRect = { x: 238, y: 158, w: 82, h: 22 }

/* ============================================================================
 * 生成
 * ========================================================================== */

export function createApp(deps: AppDeps): App {
  const save = loadSave(deps.storage)
  const stage = getStage(clampStageId(save.last, save)) ?? STAGES[0]
  return {
    deps,
    phase: 'TITLE',
    uiFrame: 0,
    stage,
    sim: createSim(stage),
    save,
    death: null,
    readyMessage: null,
    readyUnlock: null,
    banner: null,
    attempts: stageRecord(save, stage.id).try,
    runStartMs: 0,
    result: null,
    pendingStart: false,
    simTap: false,
    paused: false,
    recentMessages: [],
    priorityHistory: [],
    readyIdle: 0,
    viewScale: 1,
    sessionDied: false,
    consecutiveDeaths: 0,
    freshEntry: true,
    taps: [],
    sfx: [],
  }
}

function clampStageId(id: number, save: SaveData): number {
  const exists = STAGES.some((s) => s.id === id)
  if (!exists) return 1
  return stageRecord(save, id).unlock ? id : 1
}

/* ============================================================================
 * 入力（イベントハンドラはここに積むだけ）
 * ========================================================================== */

/** `pointerdown` から呼ぶ。論理座標（320×180）に変換済みの値を渡すこと */
export function queueTap(app: App, x: number, y: number): void {
  if (app.taps.length >= 4) return // 連打の暴発を抑える。O(1) を守る
  app.taps.push({ x, y })
}

/** `keydown` から呼ぶ。ジャンプ相当のキーは画面中央のタップとして扱う */
export function queueKey(app: App, code: string): void {
  if (code === 'Escape') {
    app.taps.push({ x: -1, y: -1 }) // 戻る操作の印
    return
  }
  queueTap(app, LOGICAL_W / 2, LOGICAL_H / 2)
}

/* ============================================================================
 * 1 フレーム進める
 * ========================================================================== */

/**
 * 固定タイムステップ 1/60s の 1 フレーム。
 * 呼び出し側（GameClient）は GDD §12-1 のアキュムレータ方式でこれを回す。
 */
export function advanceFrame(app: App): void {
  app.uiFrame++

  // ① 入力の取り込み（フレーム頭で 1 つだけ処理する）
  const tap = app.taps.shift() ?? null
  if (tap) dispatchTap(app, tap.x, tap.y)

  if (app.banner && app.uiFrame >= app.banner.until) app.banner = null

  if (app.paused) return

  // ② 固定ステップ更新
  switch (app.phase) {
    case 'PLAY':
      stepPlay(app)
      break
    case 'HITSTOP':
    case 'BURST':
      stepDeath(app)
      break
    case 'READY':
      if (app.death) {
        app.death.frame++ // 到達率表示（400ms / 600ms）を進める
        // 死亡後の READY だけがアイドルタイマーを回す（GDD §14-16-3）。
        // 連打している人の前には現れないので、憲法3 の「摩擦ゼロのリトライ」は損なわれない
        app.readyIdle++
      }
      break
    default:
      break
  }
}

function stepPlay(app: App): void {
  const tap = app.simTap
  app.simTap = false
  const wasGrounded = app.sim.player.state === 'GROUNDED'

  stepSim(app.stage, app.sim, tap)

  if (tap && app.sim.player.state === 'RISING') app.sfx.push('JUMP')
  if (!wasGrounded && app.sim.player.state === 'GROUNDED') app.sfx.push('LAND')

  if (app.sim.dead) {
    enterDeath(app)
    return
  }
  if (app.sim.cleared) enterResult(app)
}

function stepDeath(app: App): void {
  const d = app.death
  if (!d) return
  d.frame++
  if (d.frame < DEATH_HITSTOP) {
    app.phase = 'HITSTOP'
  } else if (d.frame < DEATH_TOTAL_FRAMES) {
    app.phase = 'BURST'
  } else {
    // 300ms 経過。ステージ先頭へリセットし、入力受付を開始する
    resetSim(app.stage, app.sim)
    app.phase = 'READY'
    app.readyIdle = 0
    if (app.pendingStart) {
      app.pendingStart = false
      startRun(app)
    }
  }
}

/* ============================================================================
 * タップの振り分け
 * ========================================================================== */

function dispatchTap(app: App, x: number, y: number): void {
  const isBack = x < 0

  // タブ復帰（GDD §12-1 / UIテキスト §19-3）。
  // 復帰のタップはジャンプに使わない。試行回数も進捗バーも動かさず、
  // 止まった盤面のまま続きを再開するだけ。
  if (app.paused) {
    if (isBack) {
      app.paused = false
      app.phase = 'SELECT'
      return
    }
    app.paused = false
    return
  }

  switch (app.phase) {
    case 'TITLE':
      if (isBack) return
      if (inRect(HIT_TITLE_SFX, x, y)) {
        app.save.opt.sfx = !app.save.opt.sfx
        writeSave(app.deps.storage, app.save) // 設定変更時に 1 回（GDD §10-2）
        return
      }
      if (inRect(HIT_TITLE_FLASH, x, y)) {
        app.save.opt.reducedFlash = !app.save.opt.reducedFlash
        writeSave(app.deps.storage, app.save)
        return
      }
      if (inRect(HIT_TITLE_STAGES, x, y)) {
        app.phase = 'SELECT'
        return
      }
      enterStage(app, clampStageId(app.save.last, app.save))
      return

    case 'SELECT': {
      if (isBack || inRect(HIT_SELECT_BACK, x, y)) {
        app.phase = 'TITLE'
        return
      }
      for (let i = 0; i < HIT_SELECT_CARDS.length && i < STAGES.length; i++) {
        if (!inRect(HIT_SELECT_CARDS[i], x, y)) continue
        const id = STAGES[i].id
        if (!stageRecord(app.save, id).unlock) return // 未解放は反応しない
        enterStage(app, id)
        return
      }
      return
    }

    case 'READY':
      if (isBack) {
        app.phase = 'SELECT'
        return
      }
      // 離脱導線はフェードイン完了後のみ反応する。それ以外の全領域・全タイミングは
      // 従来どおりリトライ（GDD §14-16-3）
      if (exitTappable(app) && inRect(exitHitRect(app), x, y)) {
        app.phase = 'SELECT'
        app.readyIdle = 0
        return
      }
      app.readyIdle = 0
      startRun(app)
      return

    case 'PLAY':
      if (isBack) {
        app.phase = 'SELECT'
        return
      }
      // 画面全域がジャンプ入力（UIテキスト §7）。HUD の上でも発火する
      app.simTap = true
      return

    case 'HITSTOP':
    case 'BURST':
      // 死亡演出中のタップはバッファする（GDD §1-2）。体感待ち時間をゼロにする
      if (!isBack) app.pendingStart = true
      return

    case 'RESULT': {
      if (isBack || inRect(HIT_RESULT_STAGES, x, y)) {
        app.phase = 'SELECT'
        return
      }
      if (inRect(HIT_RESULT_RETRY, x, y)) {
        enterStage(app, app.stage.id)
        return
      }
      // 既定は NEXT。次が無ければセレクトへ戻す
      const next = STAGES.find((s) => s.id === app.stage.id + 1)
      if (next && stageRecord(app.save, next.id).unlock) enterStage(app, next.id)
      else app.phase = 'SELECT'
      return
    }
  }
}

/* ============================================================================
 * 遷移
 * ========================================================================== */

/** ステージに入る。`READY` で `STAGE n` を 0.8 秒出し、タップで走り出す */
function enterStage(app: App, id: number): void {
  const stage = getStage(id) ?? STAGES[0]
  app.stage = stage
  app.sim = createSim(stage)
  app.phase = 'READY'
  app.death = null
  app.readyMessage = null
  app.readyUnlock = null
  app.result = null
  app.pendingStart = false
  app.simTap = false
  app.paused = false
  app.freshEntry = true
  app.readyIdle = 0
  app.attempts = stageRecord(app.save, id).try
  app.banner = { text: `STAGE ${id}`, until: app.uiFrame + BANNER_STAGE_FRAMES }
  app.save.last = id
}

/** 走り出す。リトライ時は `STAGE n` を出さない（UIテキスト §4） */
function startRun(app: App): void {
  resetSim(app.stage, app.sim)
  app.death = null
  app.readyMessage = null
  app.readyUnlock = null
  app.attempts += 1
  app.runStartMs = app.deps.now()
  app.phase = 'PLAY'
  app.simTap = false
  app.banner = app.freshEntry
    ? { text: 'GO!', until: app.uiFrame + BANNER_GO_FRAMES }
    : null
  app.freshEntry = false
}

/** 死亡確定。記録の更新と保存はここで 1 回だけ行う（GDD §10-2） */
function enterDeath(app: App): void {
  const rec = stageRecord(app.save, app.stage.id)
  const reachPct = progressRatio(app.stage, app.sim.stageFrame) * 100
  const bestBefore = rec.best
  const newBest = reachPct > bestBefore

  rec.try = app.attempts
  rec.die += 1
  if (newBest) rec.best = reachPct
  rec.marks = [reachPct, ...rec.marks].slice(0, MARKS_KEEP)

  app.save.total.die += 1
  app.save.total.playMs += Math.max(0, app.deps.now() - app.runStartMs)
  app.consecutiveDeaths += 1

  // 50回死亡による解放（GDD §6-5【P1】）。クリア扱いにはしない
  const mercyUnlock = rec.die >= MERCY_DEATHS && unlockNext(app, app.stage.id)

  const ctx: MessageContext = {
    stageId: app.stage.id,
    reachPct,
    bestPct: bestBefore,
    newBest,
    attempts: app.attempts,
    marks: rec.marks,
    totalDeaths: app.save.total.die,
    consecutiveDeaths: app.consecutiveDeaths,
    sessionFirstDeath: !app.sessionDied,
    mercyUnlock,
    // 直前2回のいずれかで優先が発火していたら、今回は優先を見送る（UIテキスト §19-2）
    priorityRecent: app.priorityHistory.some(Boolean),
  }
  const picked = pickDeathMessage(ctx, app.recentMessages, app.deps.random)
  app.readyMessage = picked.text
  // 単発 ONCE で出した文は除外履歴に入れない（UIテキスト §14-5 / §19-2）
  if (!picked.fixed) app.recentMessages = [picked.text, ...app.recentMessages].slice(0, 2)
  app.priorityHistory = [picked.priority, ...app.priorityHistory].slice(0, 2)
  app.readyUnlock = mercyUnlock
    ? ([`STAGE ${pad2(app.stage.id + 1)}`, 'UNLOCKED'] as const)
    : null
  app.sessionDied = true

  app.death = {
    frame: 0,
    killerId: app.sim.deathObjIndex >= 0 ? app.sim.deathObjIndex : null,
    reachPct,
    newBest,
  }
  app.phase = 'HITSTOP'
  app.sfx.push('DEATH')
  if (newBest) app.sfx.push('BEST')

  writeSave(app.deps.storage, app.save)
}

/** クリア確定。記録の更新と保存はここで 1 回だけ */
function enterResult(app: App): void {
  const rec = stageRecord(app.save, app.stage.id)
  const timeMs = Math.max(0, app.deps.now() - app.runStartMs)
  const firstClear = !rec.clear
  const newRecord = rec.time == null || timeMs < rec.time

  rec.try = app.attempts
  rec.clear = true
  rec.best = 100
  if (newRecord) rec.time = timeMs
  app.save.total.playMs += timeMs
  app.consecutiveDeaths = 0

  const unlocked = unlockNext(app, app.stage.id) ? app.stage.id + 1 : null
  const allClear = STAGES.every((s) => stageRecord(app.save, s.id).clear)

  app.result = {
    timeMs,
    newRecord,
    firstClear,
    deaths: rec.die,
    unlockedStageNo: unlocked,
    allClear,
  }
  app.phase = 'RESULT'
  app.death = null
  app.sfx.push('CLEAR')
  writeSave(app.deps.storage, app.save)
}

/** 次ステージを解放する。既に解放済み／次が無ければ false */
function unlockNext(app: App, id: number): boolean {
  const next = STAGES.find((s) => s.id === id + 1)
  if (!next) return false
  const rec = stageRecord(app.save, next.id)
  if (rec.unlock) return false
  rec.unlock = true
  return true
}

/**
 * 離脱導線 `← STAGES` の表示段階（GDD §14-16-3 / 描画層 改訂R9）。
 *
 * **死亡後の `READY` でしか顕在化しない。** `RUNNING` 中・ポーズ中・ステージ入場直後の
 * `READY` では常に `HIDDEN` を返す。しきい値（90f / 6f刻み / +18f で受付）は
 * 描画層の `exitPromptPhaseOf()` に一元化されており、ここでは持たない。
 */
export function exitPhase(app: App): ExitPromptPhase {
  if (app.phase !== 'READY' || app.paused || !app.death) return 'HIDDEN'
  return exitPromptPhaseOf(app.readyIdle)
}

/** フェードイン完了後の猶予（6f）まで進んだ段階でのみ操作できる */
export function exitTappable(app: App): boolean {
  return isExitTapAccepted(exitPhase(app))
}

/**
 * 離脱導線のタップ判定領域（論理座標）。描画（56×12px）より広く、
 * どの整数倍スケールでも 44×44 CSS px 以上になる。矩形の算出は描画層に委ねる。
 */
export function exitHitRect(app: App): { x: number; y: number; w: number; h: number } {
  return exitTapRegion(app.viewScale)
}

/** 整数倍スケールが変わったら知らせる（判定領域の CSS px 換算に使う） */
export function setViewScale(app: App, scale: number): void {
  app.viewScale = Math.max(1, Math.floor(scale))
}

/** タブが隠れたら即ポーズ。復帰時はタップで再開する（GDD §12-1） */
export function setHidden(app: App, hidden: boolean): void {
  if (hidden && app.phase === 'PLAY') app.paused = true
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/* ============================================================================
 * RenderState の組み立て
 * ========================================================================== */

/** エンジンの障害物種別 → 描画層の種別（1:1 対応。GDD §5-1） */
function renderKindOf(o: ResolvedObj): RenderObstacleKind | null {
  switch (o.kind) {
    case 'block':
      return o.w >= 24 && o.h >= 32 ? 'BLOCK_L' : 'BLOCK_S'
    case 'spike':
      return 'SPIKE'
    case 'ceil':
      return 'CEILING'
    case 'plat':
      return 'PLATFORM'
    case 'lift':
      return 'LIFTER'
    case 'fly':
      return 'FLYER'
    case 'crumble':
      return 'CRUMBLE'
    case 'spring':
      return 'SPRING'
    // 谷は地形として stage.pits で描く。予告マーカーは判定も描画も持たない
    case 'pit':
    case 'warn':
      return null
  }
}

function pitsOf(stage: StageDef): RenderPit[] {
  const out: RenderPit[] = []
  for (const o of stage.objects) if (o.t === 'pit') out.push({ worldX: o.x, w: o.w })
  return out
}

/** TITLE の走行デモ。操作不能・完全に決定論（uiFrame の純関数） */
function titleDemo(uiFrame: number): { y: number; motion: 'RUN' | 'RISE' | 'FALL'; worldX: number } {
  const period = 120
  const k = ((uiFrame % period) + period) % period
  const ground = GROUND_Y - PLAYER_SPRITE_H
  if (k >= 1 && k <= 41) {
    const h = jumpHeightAt(k)
    return { y: ground - Math.max(0, h), motion: k <= 20 ? 'RISE' : 'FALL', worldX: uiFrame * 2.5 }
  }
  return { y: ground, motion: 'RUN', worldX: uiFrame * 2.5 }
}

function selectEntries(app: App): RenderSelectEntry[] {
  // 第3幕のスコープ: S1–S3 のみ。S4 以降は**そもそも描かない**（UIテキスト §11-4）
  return STAGES.slice(0, 3).map((s) => {
    const rec = stageRecord(app.save, s.id)
    return {
      no: s.id,
      name: s.name,
      state: !rec.unlock ? 'LOCKED' : rec.clear ? 'CLEARED' : 'OPEN',
      bestPct: rec.best > 0 ? rec.best : null,
      bestTimeMs: rec.time,
    }
  })
}

const RENDER_PHASE: Record<AppPhase, RenderPhase> = {
  TITLE: 'TITLE',
  SELECT: 'SELECT',
  READY: 'READY',
  PLAY: 'PLAY',
  HITSTOP: 'HITSTOP',
  BURST: 'BURST',
  RESULT: 'RESULT',
}

/** 1 フレームぶんの描画情報を組み立てる。描画層はこれ以外を参照しない */
export function buildRenderState(app: App): RenderState {
  const { stage, sim } = app
  const isTitle = app.phase === 'TITLE'
  const phase: RenderPhase = app.paused ? 'READY' : RENDER_PHASE[app.phase]
  const rec = stageRecord(app.save, stage.id)

  const obstacles: RenderObstacle[] = []
  if (!isTitle && app.phase !== 'SELECT' && app.phase !== 'RESULT') {
    for (const o of resolveVisibleObjects(stage, sim.stageFrame, sim)) {
      const kind = renderKindOf(o)
      if (!kind) continue
      obstacles.push({
        id: o.index,
        kind,
        worldX: o.x,
        y: o.y,
        w: o.w,
        h: o.h,
        hidden: o.gone,
      })
    }
  }

  const demo = titleDemo(app.uiFrame)
  const motion: 'RUN' | 'RISE' | 'FALL' =
    sim.player.state === 'RISING' ? 'RISE' : sim.player.state === 'FALLING' ? 'FALL' : 'RUN'

  // 死亡中は進捗バーを死亡地点で止める（GDD §11-5）
  const progress = app.death ? app.death.reachPct / 100 : progressRatio(stage, sim.stageFrame)

  return {
    phase,
    stageFrame: sim.stageFrame,
    uiFrame: app.uiFrame,
    cameraX: isTitle ? 0 : cameraX(stage, sim.stageFrame),
    reducedFlash: app.save.opt.reducedFlash,
    touchDevice: app.deps.touchDevice,

    player: {
      y: isTitle ? demo.y : sim.player.y,
      motion: isTitle ? demo.motion : motion,
      worldX: isTitle ? demo.worldX : playerWorldX(stage, sim.stageFrame),
      visible: app.phase !== 'BURST',
    },
    obstacles,
    stage: {
      id: stage.id,
      name: stage.name,
      lengthPx: stage.lengthPx,
      groundY: stage.groundY,
      tilePattern: (Math.min(2, Math.max(0, stage.id - 1)) as 0 | 1 | 2),
      pits: isTitle ? [] : pitsOf(stage),
    },
    hud: {
      stageNo: stage.id,
      progress,
      best: rec.best > 0 ? rec.best / 100 : null,
      marks: rec.marks.map((m) => m / 100),
      attempts: app.attempts,
    },

    death: app.death
      ? {
          killerId: app.death.killerId,
          reachPct: app.death.reachPct,
          newBest: app.death.newBest,
          frame: app.death.frame,
        }
      : null,
    readyMessage: app.phase === 'READY' && !app.paused ? app.readyMessage : null,
    readyUnlock: app.phase === 'READY' && !app.paused ? app.readyUnlock : null,
    banner: app.banner ? { text: app.banner.text } : null,
    exitPrompt: exitPhase(app),

    title: isTitle
      ? {
          totalDeaths: app.save.total.die,
          sfxOn: app.save.opt.sfx,
          flashOn: !app.save.opt.reducedFlash,
        }
      : undefined,
    select: app.phase === 'SELECT' ? { entries: selectEntries(app), showPracticeHint: false } : undefined,
    result: app.phase === 'RESULT' && app.result ? app.result : undefined,
  }
}

/** GameClient が毎フレーム回収する。回収したらキューは空になる */
export function takeSfx(app: App): SfxKind[] {
  if (app.sfx.length === 0) return []
  const out = app.sfx
  app.sfx = []
  return out
}

export { LOGICAL_W, LOGICAL_H }
