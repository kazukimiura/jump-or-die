/**
 * JumpOrDie — ステージ実行時
 *
 * 出典: GDD §5-4（動体の決定論）/ §7-1（データ構造）/ §12-6（決定論の保証）
 *
 * 【絶対制約】
 * - `Math.random()` を一切使わない。障害物の配置・挙動はすべて stageFrame の純関数
 * - `Date.now()` / `performance.now()` をロジックに使わない。すべて stageFrame（整数）で駆動
 * - 同じ stageFrame なら必ず同じ結果になる。リトライは stageFrame = 0 に戻すだけ
 *
 * 本ファイルは 1/60s の固定ステップ更新 `stepSim()` も持つ。
 * ソルバ（solver.ts）は **この同じ関数** でステージを検査するため、
 * 検査結果と実プレイの挙動が乖離しない。
 */

import {
  CEIL_H,
  CRUMBLE_FALL_FRAMES,
  CRUMBLE_H,
  CRUMBLE_W,
  FLY_ALT_Y,
  FLY_H,
  FLY_W,
  LIFT_H,
  LIFT_W,
  LOGICAL_H,
  LOGICAL_W,
  PLAT_H,
  PLAT_W,
  PLAYER_SPRITE_H,
  PLAYER_X,
  SPIKE_H,
  SPIKE_UNIT,
  SPRING_H,
  SPEAR_HIT_W,
  SPEAR_IDLE_H,
  SPEAR_TIP_INSET,
  SPEAR_VIS_W,
  SPRING_V0,
  SPRING_W,
  SWING_H,
  SWING_W,
} from './constants'
import {
  causeOf,
  findLanding,
  findLethalHit,
  findSupport,
  isFallDeath,
  isGroundSolid,
  surfaceOf,
} from './collision'
import { NO_TAP, canJumpNow, hasBufferedTap } from './input'
import {
  createPlayer,
  footSpan,
  footY,
  integrateVertical,
  lethalBottom,
  lethalRect,
  startJump,
} from './physics'
import type {
  ObjDef,
  ResolvedObj,
  SimState,
  StageDef,
  Surface,
} from './types'

// ---------------------------------------------------------------------------
// ステージインデックス（毎フレームの走査を避けるための前処理）
// ---------------------------------------------------------------------------

/** ワールドXが時間で動かない障害物（OB-08 飛行体以外すべて） */
type StaticObjDef = Exclude<ObjDef, { t: 'fly' }>

type StageIndex = {
  /** ワールドXが不変の障害物（fly 以外すべて）。x 昇順 */
  statics: { def: StaticObjDef; index: number }[]
  /** 飛行体 OB-08。ワールドXが時間で動く */
  flyers: { def: Extract<ObjDef, { t: 'fly' }>; index: number; activateFrame: number }[]
  /** 谷。x 昇順。地面の健在判定に使う */
  pits: { x: number; w: number }[]
  /** 崩落床の添字 -> crumbleTrigger の添字 */
  crumbleSlot: Map<number, number>
  crumbleCount: number
}

const indexCache = new WeakMap<StageDef, StageIndex>()

export function buildStageIndex(stage: StageDef): StageIndex {
  const cached = indexCache.get(stage)
  if (cached) return cached

  const statics: StageIndex['statics'] = []
  const flyers: StageIndex['flyers'] = []
  const pits: { x: number; w: number }[] = []
  const crumbleSlot = new Map<number, number>()
  let crumbleCount = 0

  for (let i = 0; i < stage.objects.length; i++) {
    const def = stage.objects[i]
    if (def.t === 'fly') {
      // 画面右端に入るフレーム。定数（GDD §5-4）
      const activateFrame = Math.ceil((def.x - LOGICAL_W) / stage.speedPxPerFrame)
      flyers.push({ def, index: i, activateFrame })
    } else {
      statics.push({ def, index: i })
      if (def.t === 'pit') pits.push({ x: def.x, w: def.w })
      if (def.t === 'crumble') crumbleSlot.set(i, crumbleCount++)
    }
  }

  const built: StageIndex = { statics, flyers, pits, crumbleSlot, crumbleCount }
  indexCache.set(stage, built)
  return built
}

// ---------------------------------------------------------------------------
// 座標
// ---------------------------------------------------------------------------

/** カメラX。stageFrame から一意に決まる（GDD §7-1） */
export function cameraX(stage: StageDef, stageFrame: number): number {
  return stageFrame * stage.speedPxPerFrame
}

/** プレイヤーのワールドX（スプライト左上）。画面上のXは常に 56 固定 */
export function playerWorldX(stage: StageDef, stageFrame: number): number {
  return cameraX(stage, stageFrame) + PLAYER_X
}

/** ワールドX -> 画面X。描画時に Math.round() すること（GDD §12-3） */
export function toScreenX(stage: StageDef, stageFrame: number, worldX: number): number {
  return worldX - cameraX(stage, stageFrame)
}

/** 到達率 0..1 */
export function progressRatio(stage: StageDef, stageFrame: number): number {
  const r = playerWorldX(stage, stageFrame) / stage.lengthPx
  return r < 0 ? 0 : r > 1 ? 1 : r
}

/** ゴールに到達する stageFrame */
export function goalFrame(stage: StageDef): number {
  return Math.ceil((stage.lengthPx - PLAYER_X) / stage.speedPxPerFrame)
}

// ---------------------------------------------------------------------------
// 動体の決定論（GDD §5-4）
// ---------------------------------------------------------------------------

/**
 * OB-14 槍の伸長開始フレーム。**cameraX（= stageFrame x 速度）のみから決まる。**
 * プレイヤーの位置・速度・入力・状態を一切参照しない（§15-5-4【P0】）。
 */
export function spearRiseStart(stage: StageDef, def: { triggerX: number }): number {
  // triggerX < 0 は**静止モード**（常時展開の静止トゲ柱）。GDD §15-14 #5
  if (def.triggerX < 0) return Number.NEGATIVE_INFINITY
  return def.triggerX / stage.speedPxPerFrame
}

/**
 * OB-14 槍の視覚高さ（＝伸長量）。`H(f) = h * clamp((f - riseStart) / rise, 0, 1)` の線形。
 * 伏せ状態でも 2px は見えている（伏せている基部が見えることは §15-5-5 で【P0】）。
 * 描画層の `spearVisualHeight()` と同一の式で、両者がずれないようにしてある。
 */
export function spearHeightAt(
  def: { h: number; rise: number },
  riseStart: number,
  stageFrame: number,
): number {
  // 静止モードは最初から伸びきっている
  if (riseStart === Number.NEGATIVE_INFINITY) return def.h
  if (stageFrame < riseStart) return SPEAR_IDLE_H
  const t = def.rise <= 0 ? 1 : Math.max(0, Math.min(1, (stageFrame - riseStart) / def.rise))
  return Math.max(SPEAR_IDLE_H, Math.round(def.h * t))
}

/** 三角波。0 -> 1 -> 0 を周期1で往復する。t は周期で割った値 */
export function triangle(t: number): number {
  const u = t - Math.floor(t)
  return u < 0.5 ? u * 2 : 2 - u * 2
}

/** OB-07 昇降ブロックの上面y。整数に丸めて見た目と判定を一致させる */
export function liftY(
  anchorY: number,
  amp: number,
  period: number,
  phase: number,
  stageFrame: number,
): number {
  if (period <= 0) return anchorY
  return Math.round(anchorY - amp * triangle((stageFrame + phase) / period))
}

/** OB-08 飛行体のワールドX（GDD §5-4 の式を world 座標に展開したもの） */
export function flyWorldX(
  anchorX: number,
  vx: number,
  activateFrame: number,
  stageFrame: number,
): number {
  return Math.round(anchorX - vx * Math.max(0, stageFrame - activateFrame))
}

// ---------------------------------------------------------------------------
// 障害物の解決（stageFrame の純関数）
// ---------------------------------------------------------------------------

function resolveStatic(
  stage: StageDef,
  def: StaticObjDef,
  index: number,
  stageFrame: number,
  sim: SimState | null,
  idx: StageIndex,
): ResolvedObj {
  const g = stage.groundY
  const base = { index, def, kind: def.t, gone: false, springy: false }

  switch (def.t) {
    case 'block':
      return { ...base, x: def.x, y: g - def.h, w: def.w, h: def.h, landable: true, lethal: true }
    case 'pit':
      return { ...base, x: def.x, y: g, w: def.w, h: LOGICAL_H - g, landable: false, lethal: false }
    case 'spike':
      return {
        ...base,
        x: def.x,
        y: g - SPIKE_H,
        w: def.n * SPIKE_UNIT,
        h: SPIKE_H,
        landable: false,
        lethal: true,
      }
    case 'ceil':
      return { ...base, x: def.x, y: def.y, w: def.w, h: CEIL_H, landable: false, lethal: true }
    case 'plat':
      return { ...base, x: def.x, y: def.y, w: PLAT_W, h: PLAT_H, landable: true, lethal: false }
    case 'lift':
      return {
        ...base,
        x: def.x,
        y: liftY(def.y, def.amp, def.period, def.phase, stageFrame),
        w: LIFT_W,
        h: LIFT_H,
        landable: true,
        lethal: true,
      }
    case 'crumble': {
      const slot = idx.crumbleSlot.get(index) ?? -1
      const trig = sim && slot >= 0 ? sim.crumbleTrigger[slot] : -1
      const fallen = trig >= 0 && stageFrame >= trig + def.delay
      const vanished = trig >= 0 && stageFrame >= trig + def.delay + CRUMBLE_FALL_FRAMES
      return {
        ...base,
        x: def.x,
        y: def.y,
        w: CRUMBLE_W,
        h: CRUMBLE_H,
        landable: !fallen,
        lethal: false,
        gone: vanished,
      }
    }
    case 'swing':
      return {
        ...base,
        // 三角波・等速。毎フレーム解き、判定解決時点で整数に丸める（§12-3 動体例外）
        x: Math.round(def.x + def.amp * triangle((stageFrame + def.phase) / def.period)),
        y: def.y,
        w: SWING_W,
        h: SWING_H,
        landable: true,
        lethal: true,
      }
    case 'spear': {
      // トリガーは cameraX のみ。プレイヤーの位置・状態を一切参照しない（§15-5-4【P0】）
      const riseStart = spearRiseStart(stage, def)
      // 致死は「伸び始めたフレームから」。描画層の spearIsLethal() と同一規則
      const up = stageFrame >= riseStart
      const visH = spearHeightAt(def, riseStart, stageFrame)
      // 判定上端は視覚頂点より 2px 下（§4-3 のトゲと同思想の甘さ）
      const hitH = Math.max(0, visH - SPEAR_TIP_INSET)
      return {
        ...base,
        x: def.x + (SPEAR_VIS_W - SPEAR_HIT_W) / 2,
        y: g - hitH,
        w: SPEAR_HIT_W,
        h: hitH,
        landable: false,
        lethal: up && hitH > 0,
      }
    }
    case 'spring':
      return {
        ...base,
        x: def.x,
        y: g - SPRING_H,
        w: SPRING_W,
        h: SPRING_H,
        landable: true,
        lethal: false,
        springy: true,
      }
    case 'warn':
      return { ...base, x: def.x, y: g, w: 8, h: 2, landable: false, lethal: false }
    default: {
      const never: never = def
      throw new Error(`unknown object: ${JSON.stringify(never)}`)
    }
  }
}

/** statics の中で x >= target となる最初の位置（二分探索） */
function lowerBound(statics: StageIndex['statics'], target: number): number {
  let lo = 0
  let hi = statics.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (objX(statics[mid].def) < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

function objX(def: StaticObjDef): number {
  return def.x
}

/** 障害物の最大幅。カリングの余白に使う（OB-04 天井が最大 96px） */
const MAX_OBJ_W = 128

/**
 * ワールドX区間 [xL, xR) に掛かる障害物を解決して返す。
 * 描画カリングと当たり判定の双方で使う。**objects が x 昇順であることが前提**。
 */
export function resolveObjectsInRange(
  stage: StageDef,
  stageFrame: number,
  xL: number,
  xR: number,
  sim: SimState | null = null,
): ResolvedObj[] {
  const idx = buildStageIndex(stage)
  const out: ResolvedObj[] = []

  let i = lowerBound(idx.statics, xL - MAX_OBJ_W)
  for (; i < idx.statics.length; i++) {
    const s = idx.statics[i]
    if (s.def.x >= xR) break
    const r = resolveStatic(stage, s.def, s.index, stageFrame, sim, idx)
    if (r.x + r.w <= xL) continue
    out.push(r)
  }

  for (let f = 0; f < idx.flyers.length; f++) {
    const fl = idx.flyers[f]
    const x = flyWorldX(fl.def.x, fl.def.vx, fl.activateFrame, stageFrame)
    if (x + FLY_W <= xL || x >= xR) continue
    out.push({
      index: fl.index,
      def: fl.def,
      kind: 'fly',
      x,
      y: FLY_ALT_Y[fl.def.alt],
      w: FLY_W,
      h: FLY_H,
      landable: false,
      lethal: true,
      springy: false,
      gone: false,
    })
  }

  return out
}

/** 画面に映る障害物（描画用）。左右に16pxの余白を取る */
export function resolveVisibleObjects(
  stage: StageDef,
  stageFrame: number,
  sim: SimState | null = null,
): ResolvedObj[] {
  const cx = cameraX(stage, stageFrame)
  return resolveObjectsInRange(stage, stageFrame, cx - 16, cx + LOGICAL_W + 16, sim)
}

// ---------------------------------------------------------------------------
// シミュレーション
// ---------------------------------------------------------------------------

export function createSim(stage: StageDef): SimState {
  const idx = buildStageIndex(stage)
  const crumbleTrigger = new Int32Array(idx.crumbleCount)
  crumbleTrigger.fill(-1)
  return {
    stageFrame: 0,
    player: createPlayer(stage.groundY),
    lastTapFrame: NO_TAP,
    crumbleTrigger,
    dead: false,
    deathCause: null,
    deathObjIndex: -1,
    cleared: false,
  }
}

/** リトライ。stageFrame = 0 に戻すだけで完全に同一の状態になる（GDD §12-6） */
export function resetSim(stage: StageDef, sim: SimState): void {
  const fresh = createSim(stage)
  sim.stageFrame = 0
  sim.player = fresh.player
  sim.lastTapFrame = NO_TAP
  sim.crumbleTrigger = fresh.crumbleTrigger
  sim.dead = false
  sim.deathCause = null
  sim.deathObjIndex = -1
  sim.cleared = false
}

export function cloneSim(sim: SimState): SimState {
  return {
    stageFrame: sim.stageFrame,
    player: { ...sim.player },
    lastTapFrame: sim.lastTapFrame,
    crumbleTrigger:
      sim.crumbleTrigger.length === 0 ? sim.crumbleTrigger : sim.crumbleTrigger.slice(),
    dead: sim.dead,
    deathCause: sim.deathCause,
    deathObjIndex: sim.deathObjIndex,
    cleared: sim.cleared,
  }
}

/** 判定に使う障害物だけを集める。予告マーカーと谷は除外する */
function collisionObjects(
  stage: StageDef,
  sim: SimState,
  worldX: number,
): ResolvedObj[] {
  return resolveObjectsInRange(stage, sim.stageFrame, worldX - 48, worldX + 64, sim).filter(
    (o) => o.kind !== 'warn' && o.kind !== 'pit',
  )
}

/**
 * 固定タイムステップ 1/60s の 1 フレーム更新。
 *
 * 呼び出し側（ゲームループ）は GDD §12-1 のアキュムレータ方式で
 * この関数を回すこと。可変 dt を渡す口は用意しない。
 *
 * @param tap このフレームに入力があったか（イベントハンドラのフラグを取り込んだ値）
 */
export function stepSim(stage: StageDef, sim: SimState, tap: boolean): void {
  if (sim.dead || sim.cleared) return

  const p = sim.player
  const idx = buildStageIndex(stage)

  if (tap) sim.lastTapFrame = sim.stageFrame

  // 1. 前フレームの致死ボックス下辺を保持（GDD §4-4 判定順序1）
  p.prevLethalBottom = lethalBottom(p.y)

  const wasGrounded = p.state === 'GROUNDED'

  // 2. ジャンプ判定。接地中 or コヨーテ猶予中 かつ バッファ窓内のタップ
  let jumped = false
  if (canJumpNow(sim.stageFrame, p) && hasBufferedTap(sim.stageFrame, sim.lastTapFrame)) {
    startJump(p)
    sim.lastTapFrame = NO_TAP // 消費する。使い回さない
    jumped = true
  }

  // 3. 垂直積分（接地して跳ばなかったフレームは積分しない）
  if (!wasGrounded || jumped) integrateVertical(p)

  // 4. 世界が進む
  sim.stageFrame += 1

  // 5. 判定解決
  const worldX = playerWorldX(stage, sim.stageFrame)
  const objs = collisionObjects(stage, sim, worldX)
  const span = footSpan(worldX)
  const fy = footY(p.y)

  const surfaces: Surface[] = []
  for (let i = 0; i < objs.length; i++) {
    const s = surfaceOf(objs[i])
    if (s) surfaces.push(s)
  }
  if (isGroundSolid(idx.pits, span.left, span.right)) {
    surfaces.push({
      top: stage.groundY,
      x: span.left,
      w: span.right - span.left,
      index: -1,
      springy: false,
    })
  }

  if (wasGrounded && !jumped) {
    // 接地維持。乗っている面が動けば追従する（OB-07）
    const sup = findSupport(surfaces, span.left, span.right, fy)
    if (sup) {
      landOn(stage, sim, sup, false)
    } else {
      // 踏み外し。ここから COYOTE_TIME フレームはジャンプを受け付ける
      p.state = 'FALLING'
      p.supportIndex = null
    }
  } else if (p.vy > 0) {
    const land = findLanding(surfaces, span.left, span.right, p.prevLethalBottom, footY(p.y))
    if (land) landOn(stage, sim, land, true)
  }

  // 6. 致死判定
  const lr = lethalRect(worldX, p.y)
  const hit = findLethalHit(objs, lr, p.supportIndex ?? -2)
  if (hit >= 0) {
    sim.dead = true
    sim.deathCause = causeOf(objs[hit].kind)
    sim.deathObjIndex = objs[hit].index
    p.state = 'DEAD'
    return
  }

  // 7. 落下死（GDD §4-5）
  if (isFallDeath(p.y, stage.groundY)) {
    sim.dead = true
    sim.deathCause = 'FALL'
    sim.deathObjIndex = -1
    p.state = 'DEAD'
    return
  }

  // 8. ゴール
  if (worldX >= stage.lengthPx) sim.cleared = true
}

function landOn(stage: StageDef, sim: SimState, s: Surface, fromAir: boolean): void {
  const p = sim.player
  p.y = s.top - PLAYER_SPRITE_H

  if (s.springy) {
    // OB-10 バネ。入力不要で強制的に跳ばされる（非致死）
    startJump(p, SPRING_V0)
    return
  }

  p.vy = 0
  p.state = 'GROUNDED'
  p.lastGroundedFrame = sim.stageFrame
  p.supportIndex = s.index
  if (fromAir) {
    p.jumpedSinceGround = false
    p.groundedSince = sim.stageFrame
    // OB-09 崩落床の起動
    const idx = buildStageIndex(stage)
    const slot = idx.crumbleSlot.get(s.index)
    if (slot !== undefined && sim.crumbleTrigger[slot] < 0) {
      sim.crumbleTrigger[slot] = sim.stageFrame
    }
  }
}
