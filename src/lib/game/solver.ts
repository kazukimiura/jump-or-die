/**
 * JumpOrDie — ステージソルバ（自動検証ツール）【P1】
 *
 * 出典: GDD §7-4（検査9項目）/ §14（実装フェーズでの確定事項・2026-09-21）
 *       / §5-3（配置上限）/ §6-3（生存窓の帯・最大チェイン長）
 *
 * > すべてのステージは、機械的に「突破可能である」ことを証明してから出荷すること。
 *
 * ジャンプ弧が定数（GDD §2-4 でホールド変調を捨てた）ため、探索空間は
 * 「各フレームで跳ぶ／跳ばない」の2択のみ。接地中のフレームでしか分岐せず、
 * stageFrame は必ず増加するので状態遷移グラフは DAG。メモ化再帰で全探索できる。
 *
 * ---------------------------------------------------------------------------
 * 【勝利領域 W】
 *   W = そこからゴールに到達可能な状態の集合。`minTaps(s) < Infinity` と同値。
 *
 * 【生存窓（SURVIVABLE WINDOW）— GDD §14-①】
 *   到達状態 s（＝ジャンプ可能になった瞬間の状態）から跳ばずに進めた各フレームで
 *   「そこでタップすると W に入るか」を判定し、**連続するフレーム列の最大長**を窓とする。
 *
 *   - 縛り a: 非連続の和を取らない（連続列の最大長のみ）
 *   - 縛り b: 到達状態ごとに分けて測る（地上から／ブロック上面から を混ぜない）
 *   - 縛り c: 主指標はマキシミン経路（ボトルネック最長路）上の最小生存窓
 *
 *   【実装上の補足 — 透A】
 *   「W に入るか」を素の到達可能性だけで判定すると、窓は事実上「その接地区間の
 *   ほぼ全フレーム」になる。早すぎるタップで手前に着地しても、もう一度跳べば
 *   W に入れてしまうためである（S1 のように障害物間隔が 300px あると窓は 70f を超え、
 *   §6-3 の上限 40f を無条件に割る）。
 *   そこで判定条件を「タップの結果が W に入り、**かつそのタップが無駄にならない**
 *   （最小タップ数がちょうど 1 減る）」とした。これにより窓は「その障害物を越えるための
 *   タップを置ける連続フレーム列」という本来の意味に一致し、有界になる。
 *   §14-① が禁じた「和集合を取る」処理は行っていない。
 *   → §14-9 にて企画 駆が「フィルタであって合算ではない。むしろ必須」と承認済み。
 *   フィルタ適用後の窓は **連続フレーム列の最大長** で測る（集合の要素数ではない）。
 *   ArrivalWindows.runs に不連続な区間がそのまま残るので、runs.length で検証できる。
 *
 * 【誤帰属距離（MISATTRIBUTION GAP）— GDD §14-8】
 *   旧「詰み潜伏時間 42f 上限」は §14-8 で撤回された。置換後の指標はこちら。
 *   詰み（W からの離脱）から死亡までの間に、プレイヤーが「クリアした」と知覚する
 *   イベント（＝要求タップ地点の通過）を何個挟んだかを数える。上限 0。
 * ---------------------------------------------------------------------------
 */

import {
  BREATH_MIN,
  BREATH_TRIGGER_CHAIN,
  CHAIN_GROUND_MAX,
  JUMP_AIRTIME,
  CHAPTER_MAX_SECONDS,
  FINAL_STAGE_MAX_SECONDS,
  CHAIN_MAX_GLOBAL,
  CLIMAX_MAX_RATIO,
  CLIMAX_MIN_RATIO,
  CLIMAX_NORM_FRAMES,
  CLIMAX_WINDOW_FRAMES,
  COYOTE_TIME,
  CRUMBLE_DELAY,
  CRUMBLE_FALL_FRAMES,
  CRUMBLE_W,
  DEADEND_CTRL_WARN,
  GAP_MAX_RATIO,
  LANDING_TOLERANCE,
  LIFT_W,
  MISATTRIB_GAP_MAX,
  OBSTACLE_MAX_H,
  PIT_MAX_RATIO,
  PIT_MIN_W,
  PLAT_W,
  PLAYER_HITBOX_OX,
  PLAYER_HITBOX_W,
  SPEAR_H_MAX,
  SPEAR_H_MIN,
  SPEAR_H_PRACTICAL_MAX,
  SPEAR_RISE_MAX,
  SPEAR_RISE_MIN,
  SPIKE_UNIT,
  SWING_AMP_MAX,
  SWING_AMP_MIN,
  SWING_PERIOD_MAX,
  SWING_PERIOD_MIN,
  SWING_W,
  MAX_CONCURRENT_CRUMBLE,
  MAX_OVERLAPPING_SURFACES,
  SPIKE_MAX_WIDTH_RATIO,
  CHAPTER_TAPS_PER_SEC_BAND,
  CHAPTER_TIGHT_DENSITY_MIN,
  GATE_B_MIN,
  GATE_B_WARN,
  TIGHT_UNIT_SHARE_MAX,
  CEIL_H,
  PLAYER_HITBOX_H,
  SPEAR_TIP_INSET,
  SPEAR_VIS_W,
  DEATH_TARGET_HI,
  DEATH_TARGET_LO,
  DROP_CRUMBLE_MIN_SEPARATION,
  DROP_H,
  KNOWLEDGE_DEATH_RATIO,
  DROP_W,
  FLY_ALT_Y,
  FLY_AMP_MAX,
  FLY_AMP_MIN,
  FLY_PERIOD_MAX,
  FLY_PERIOD_MIN,
  SIGMA_MS,
  SIGMA_POINTS,
  WINDOW_MAX_MARGIN,
  CHAPTER_SUPPRESS_MAX,
  MAX_OBJECTS_PER_SECOND,
  tightWindowThreshold,
  WALL_MIN_H,
  WALL_STEP_HEADROOM,
  WALL_STEP_MIN_GROUND_FRAMES,
  FLY_LOOKAHEAD_MIN_FRAMES,
  FLY_LOOKAHEAD_WARN_FRAMES,
  FLY_VX_MAX,
  FLY_VX_MIN,
  JUMP_APEX_FRAMES,
  LOOKAHEAD_PX,
  WORST_WINDOW_WARN,
} from './constants'
import { killRect } from './collision'
import { canJumpNow } from './input'
import { horizontalReach, lethalBottom, lethalTop, spearSurvivalWindow } from './physics'
import {
  cloneSim,
  createSim,
  goalFrame,
  playerWorldX,
  progressRatio,
  resolveObjectsInRange,
  stepSim,
} from './stageRuntime'
import type {
  BlockObj,
  ObjKind,
  Rect,
  ResolvedObj,
  SimState,
  StageBudget,
  StageDef,
} from './types'

const INF = Number.POSITIVE_INFINITY

/** 状態数の安全弁。これを超えたら設計が破綻しているので探索を打ち切る */
const MAX_STATES = 4_000_000

const ZERO_PROFILE = { frames: 0, ctrl: 0 }

/**
 * 2 つの状態が「同じ場所に居る」か。
 * ワールドX は stageFrame の純関数なので、同一フレームなら足場と高さだけで決まる。
 */
function sameFooting(a: SimState, b: SimState): boolean {
  return (
    a.player.supportIndex === b.player.supportIndex &&
    Math.round(a.player.y * 64) === Math.round(b.player.y * 64)
  )
}

// ---------------------------------------------------------------------------
// 結果の型
// ---------------------------------------------------------------------------

/** 推奨ルート（マキシミン経路）上の 1 ジャンプ */
export type RouteJump = {
  /** 何本目のジャンプか（1始まり） */
  index: number
  /**
   * 推奨ルートがタップするフレーム。**実体は生存窓の先頭（`first`）である。**
   * マキシミン探索が最初に見つかる生存経路を採るため。
   * どの検査もこの値ではなく `window`（窓の幅）を使うので判定には影響しない。
   * σ の実測（§16-7）は**窓の中心**を基準にする規定なので、そちらとは別物。
   */
  frame: number
  /** 生存窓の最初のフレーム */
  first: number
  /** 生存窓の最後のフレーム */
  last: number
  /** 生存窓（連続フレーム列の長さ） */
  window: number
  /** タップ地点の到達率 0..1 */
  at: number
  /** 直前の着地からこのタップまでの接地時間（フレーム） */
  groundedFrames: number
  /** この時点での連鎖長（1 なら単発） */
  chain: number
  /**
   * この到達状態で「有効タップ」と判定された連続区間の本数（§14-9 の確認事項）。
   * 1 なら window は文字どおり1本の連続フレーム列。2 以上でも window は
   * **最大の1本の長さ**であって合計ではない。
   */
  runCount: number
}

/**
 * 詰み（勝利領域 W からの離脱）の検出結果。
 *
 * - `misattrib` … 誤帰属距離。詰み〜死亡の間に通過した要求タップ地点の数。上限 0（不合格判定）
 * - `ctrl`      … 可制御詰み潜伏時間。詰み後に接地して操作可能だったフレーム数の合計（警告）
 * - `raw`       … 素の経過。**判定に用いない**（§14-8 で撤回済み。診断ログのみ）
 */
export type DeadEnd = {
  /** 勝利領域から外れたフレーム */
  frame: number
  /** 死亡フレーム */
  deathFrame: number
  /** 素の潜伏時間（詰み→死亡）。診断のみ */
  raw: number
  /** 可制御潜伏時間（接地して操作可能だったフレーム数の合計） */
  ctrl: number
  /** 誤帰属距離（通過した要求タップ地点の数） */
  misattrib: number
  /** 外れた地点の到達率 */
  at: number
}

export type SolveResult = {
  feasible: boolean
  /** 推奨ルートでクリアしたフレーム数（到達不能なら -1） */
  frames: number
  /** 最小タップ数 */
  taps: number
  /** 推奨ルート（マキシミン経路） */
  route: RouteJump[]
  /** 主指標: 推奨ルート上の最小生存窓 */
  minWindow: number
  /** 主指標の地点（到達率） */
  minWindowAt: number
  /** 副1: 勝利到達状態すべてにわたる最小生存窓 */
  worstWindow: number
  /** 副1 の地点（到達率） */
  worstWindowAt: number
  /** 検査5: 誤帰属距離の最大値（上限 0。1以上で不合格） */
  maxMisattribGap: number
  /** 検査5b: 可制御詰み潜伏時間の最大値（42f 超で警告） */
  maxDeadEndCtrl: number
  /** 診断のみ: 素の詰み潜伏時間の最大値。判定に用いない */
  maxDeadEndRaw: number
  /** 誤帰属距離が 1 以上の地点（最大5件） */
  misattribHits: DeadEnd[]
  /** 可制御詰み潜伏が警告しきい値を超えた地点（最大5件） */
  ctrlHits: DeadEnd[]
  /** 最大チェイン長（接地 12f 以下でつながるジャンプ列の本数） */
  maxChain: number
  /** 息継ぎ規定の違反地点（到達率） */
  breathViolations: number[]
  /** 狭窓密度: 生存窓 10f 以下のジャンプ本数 / ステージ長(秒)（GDD §15-7-3） */
  tightDensity: number
  /** 抑制率: 跳んではいけない障害物の数 / 全挑戦オブジェクト数 */
  suppressRatio: number
  /** 複合度: 複合パターン区間の長さ合計 / ステージ長（警告のみ） */
  compositeRatio: number
  /** 平均要求タップ/秒（GDD §6-3 の列）。推奨ルートのタップ数 / ステージ長(秒) */
  tapsPerSecond: number
  /**
   * 期待死亡回数 `E[D] = 1/Π(1-p_i) - 1`（σ = SIGMA_MS 基準・GDD §16-7）。
   * **唯一、外部の実測量（σ）に接続された指標。** ほかは全て企画の想定から導かれている。
   */
  expectedDeaths: number
  /** σ = 30 / 40 / 50 ms の3点。プレイヤーの精度差に対する頑健性を可視化する */
  expectedDeathsBySigma: readonly { sigma: number; value: number }[]
  /** 通しクリア確率 Π(1-p_i)（σ = SIGMA_MS） */
  clearProbability: number
  /** ステージ長（秒） */
  seconds: number
  /** 区間難度 D(t) の最大値 */
  climaxD: number
  /** クライマックス（D(t) 最大区間の中心）の到達率 */
  climaxAt: number
  statesExplored: number
  arrivalsAnalyzed: number
}

export type IssueLevel = 'FAIL' | 'WARN'
export type CheckIssue = { level: IssueLevel; code: string; message: string }

export type VerifyResult = {
  stageId: number
  stageName: string
  solve: SolveResult
  issues: CheckIssue[]
  ok: boolean
}

// ---------------------------------------------------------------------------
// 状態キー
// ---------------------------------------------------------------------------

function stateKey(sim: SimState): string {
  const p = sim.player
  const coyote = Math.min(sim.stageFrame - p.lastGroundedFrame, COYOTE_TIME + 1)
  let k =
    sim.stageFrame +
    '|' +
    Math.round(p.y * 4096) +
    '|' +
    Math.round(p.vy * 4096) +
    '|' +
    p.state +
    '|' +
    (p.jumpedSinceGround ? 1 : 0) +
    '|' +
    coyote +
    '|' +
    (p.supportIndex === null ? 'n' : p.supportIndex)
  if (sim.crumbleTrigger.length > 0) {
    /*
     * 崩落床は**起動フレームそのものではなく、起動からの経過**だけが挙動を決める。
     * 生の trigger を鍵に入れると、同じ見た目の状態が起動時刻の数だけ別状態になり、
     * 状態数が組み合わせ的に爆発する（S9 で 400 万超）。
     * delay(10) + 落下(12) = 22 フレームで完全に消えるので、
     * それ以降はすべて同一視して 1 個の状態に畳む。
     */
    let c = '|'
    for (const t of sim.crumbleTrigger) {
      c += t < 0 ? 'n' : Math.min(sim.stageFrame - t, 24)
      c += ','
    }
    k += c
  }
  return k
}

// ---------------------------------------------------------------------------
// 探索エンジン
// ---------------------------------------------------------------------------

/** 到達状態（ジャンプ可能になった瞬間）から測った生存窓 */
type ArrivalWindows = {
  /** 跳ばずに進めたときのジャンプ可能フレーム列 */
  run: SimState[]
  /** 「ここでタップすれば最小タップ数を保ったまま W に入る」連続フレーム列 */
  runs: { from: number; to: number }[]
  /** 連続フレーム列の最大長 ＝ 生存窓 */
  window: number
}

class Search {
  readonly stage: StageDef
  readonly maxFrame: number
  private memoTaps = new Map<string, number>()
  private memoSurvive = new Map<string, { frames: number; ctrl: number }>()
  private memoArrival = new Map<string, ArrivalWindows>()
  private memoCoast = new Map<string, SimState[]>()

  constructor(stage: StageDef) {
    this.stage = stage
    this.maxFrame = goalFrame(stage) + 8
  }

  get states(): number {
    return this.memoTaps.size
  }

  get arrivals(): number {
    return this.memoArrival.size
  }

  advance(sim: SimState, tap: boolean): SimState {
    const next = cloneSim(sim)
    stepSim(this.stage, next, tap)
    return next
  }

  /**
   * 状態 s からゴールまでの最小タップ数。Infinity なら勝利領域 W の外。
   *
   * **再帰ではなく反復で解く。** `stageFrame` は必ず増加するので状態遷移グラフは DAG であり、
   * 「frame の昇順に集めて、降順に評価する」だけでトポロジカル順序になる。
   * 再帰にすると深さがステージのフレーム数と同じになり、
   * 長いステージ（S9 以降は 3,000〜5,000 フレーム）でコールスタックが溢れる。
   */
  minTaps(sim: SimState): number {
    if (sim.cleared) return 0
    if (sim.dead) return INF
    if (sim.stageFrame > this.maxFrame) return INF
    const rootKey = stateKey(sim)
    const hit = this.memoTaps.get(rootKey)
    if (hit !== undefined) return hit

    // 1) 前方探索で未評価の到達状態を frame ごとに集める
    const byFrame = new Map<number, { sim: SimState; key: string }[]>()
    const seen = new Set<string>([rootKey])
    let queue: { sim: SimState; key: string }[] = [{ sim, key: rootKey }]
    const push = (f: number, e: { sim: SimState; key: string }) => {
      const a = byFrame.get(f)
      if (a) a.push(e)
      else byFrame.set(f, [e])
    }
    while (queue.length > 0) {
      const next: { sim: SimState; key: string }[] = []
      for (const e of queue) {
        push(e.sim.stageFrame, e)
        if (this.memoTaps.size + seen.size > MAX_STATES) {
          throw new Error(
            `solver: 状態数が上限 ${MAX_STATES} を超えました（stage ${this.stage.id}）`,
          )
        }
        const kids: SimState[] = [this.advance(e.sim, false)]
        if (canJumpNow(e.sim.stageFrame, e.sim.player)) kids.push(this.advance(e.sim, true))
        for (const k of kids) {
          if (k.cleared || k.dead || k.stageFrame > this.maxFrame) continue
          const kk = stateKey(k)
          if (this.memoTaps.has(kk) || seen.has(kk)) continue
          seen.add(kk)
          next.push({ sim: k, key: kk })
        }
      }
      queue = next
    }

    // 2) frame の降順に評価する（後続は必ず評価済みになる）
    const frames = [...byFrame.keys()].sort((a, b) => b - a)
    for (const f of frames) {
      for (const e of byFrame.get(f)!) {
        if (this.memoTaps.has(e.key)) continue
        let best = this.valueOf(this.advance(e.sim, false))
        if (canJumpNow(e.sim.stageFrame, e.sim.player)) {
          const t = this.valueOf(this.advance(e.sim, true))
          if (t !== INF && t + 1 < best) best = t + 1
        }
        this.memoTaps.set(e.key, best)
      }
    }
    return this.memoTaps.get(rootKey) ?? INF
  }

  /** 評価済みの値を引く。基底（ゴール・死亡・フレーム超過）はその場で返す */
  private valueOf(s: SimState): number {
    if (s.cleared) return 0
    if (s.dead) return INF
    if (s.stageFrame > this.maxFrame) return INF
    return this.memoTaps.get(stateKey(s)) ?? INF
  }

  /** 勝利領域 W に属するか */
  inW(sim: SimState): boolean {
    return this.minTaps(sim) !== INF
  }

  /**
   * その状態から死ぬまでの経過（詰み潜伏の計測用）。
   * プレイヤーは生き延びようとするので、**最長の継続**を採る。
   *
   * - frames … 死亡までの総フレーム数（素の値。診断のみ）
   * - ctrl   … そのうち接地して操作可能だったフレーム数（GDD §14-8-3 の可制御詰み潜伏）
   */
  survivalProfile(sim: SimState): { frames: number; ctrl: number } {
    if (sim.dead || sim.cleared || sim.stageFrame > this.maxFrame) {
      return ZERO_PROFILE
    }

    const key = stateKey(sim)
    const hit = this.memoSurvive.get(key)
    if (hit !== undefined) return hit
    this.memoSurvive.set(key, ZERO_PROFILE)

    const jumpable = canJumpNow(sim.stageFrame, sim.player)
    let best = this.survivalProfile(this.advance(sim, false))
    if (jumpable) {
      const alt = this.survivalProfile(this.advance(sim, true))
      // 最長生存を優先し、同値なら可制御フレーム数が大きいほうを採る（保守側）
      if (alt.frames > best.frames || (alt.frames === best.frames && alt.ctrl > best.ctrl)) {
        best = alt
      }
    }

    const out = { frames: 1 + best.frames, ctrl: (jumpable ? 1 : 0) + best.ctrl }
    this.memoSurvive.set(key, out)
    return out
  }

  /**
   * 「一度も跳ばずに走り続けた」軌跡を frame 昇順で返す（先頭が `from` のフレーム）。
   * 死亡・ゴール・フレーム上限で打ち切る。拡張条項（§14-9）の比較対象。
   */
  private coastPath(from: SimState): SimState[] {
    const key = stateKey(from)
    const hit = this.memoCoast.get(key)
    if (hit) return hit
    const out: SimState[] = [from]
    let s = from
    while (!s.dead && !s.cleared && s.stageFrame <= this.maxFrame) {
      s = this.advance(s, false)
      out.push(s)
    }
    this.memoCoast.set(key, out)
    return out
  }

  /**
   * 有効タップの判定（GDD §14-9 拡張条項。第3次裁定 §14-15 #9 で実施期限が到来）。
   *
   *   タップ f が有効 ⟺ 結果状態 s' ∈ W
   *                   かつ (  T(s') <= T(s) - 1
   *                        または s' が「このフレームで跳ばずに走り続ける」ことでは
   *                           到達できない状態である )
   *
   * 【なぜ下段が要るのか】
   * 上段の厳格な等式だけだと、**追加タップを払う迂回ルートを窓計算から丸ごと除外する**。
   * 典型は §4-4 のブロック上面経由で、
   *   ルートA 跳び越える          … 1タップ。T が 1 減る → 有効
   *   ルートB 上面に乗って跳び降りる … 2タップ。乗った時点では T が減らない → 除外されていた
   * §4-4 でブロックを着地可能にしたのはまさにルートBを作るためなので、
   * 計測がそれを見ていないのは設計上の選択肢を無いものとして扱うことになる。
   * 「踏み台にしないと越えられない」配置では、正解ルートそのものが消える。
   *
   * 【なぜ無駄ホップが混入しないのか】
   * 下段は「**跳ばなければ行けない場所へ行く**」タップだけを認める。
   * 平地での無駄ホップは、跳んでも跳ばなくても同じ足場・同じ高さに着くので
   * 「走り続けでは到達できない状態」に当たらず、引き続き除外される。
   * これがフィルタの目的（§14-9 理由3: 窓を意味のある値に保つ）を守る。
   */
  private isUsefulTap(s: SimState, target: number, coast: SimState[]): boolean {
    const jumped = this.advance(s, true)
    const t = this.minTaps(jumped)
    // s' ∈ W（両条項の共通前提）
    if (t === INF) return false
    // 上段: 最小タップ数がちょうど 1 減る
    if (t + 1 === target) return true

    // 下段: 跳ばずに走り続けては到達できない状態か
    const arrival = this.nextArrival(jumped)
    if (arrival === 'DEAD') return false
    // 跳んだ先でそのままゴールできるなら、走り続けでは明らかに到達できない
    if (arrival === 'CLEARED') return true

    const base = coast[0].stageFrame
    const idx = arrival.stageFrame - base
    const same = idx >= 0 && idx < coast.length ? coast[idx] : null
    // 走り続けではそのフレームまで生きていない（＝到達できない）
    if (same === null || same.dead || same.cleared) return true
    // 同じフレームに、同じ足場・同じ高さで居るなら「跳ばなくても同じ場所」＝無駄ホップ
    return !sameFooting(same, arrival)
  }

  /**
   * 到達状態 s の生存窓を測る（GDD §14-①）。
   *
   * s から跳ばずに進め、ジャンプ可能なフレームを列挙し、**有効タップ**（下記）の
   * フレームを抽出したうえで、その **連続フレーム列** を切り出す。
   *
   * 【§14-9 の確認事項に対する実装の明言】
   * - フィルタ（有効タップ判定）→ 連続列の切り出し、の順で適用している
   * - 窓は `runs` の**要素数の合計ではなく、最長の1本の長さ**である
   * - 不連続な区間は `runs` に別要素として残るので、`runs.length` で
   *   「1本の連続区間かどうか」を検証できる（検査スクリプトが出力する）
   */
  arrivalWindows(arrival: SimState): ArrivalWindows {
    const key = stateKey(arrival)
    const hit = this.memoArrival.get(key)
    if (hit) return hit

    const target = this.minTaps(arrival)
    const run: SimState[] = []
    let s = arrival
    while (
      !s.dead &&
      !s.cleared &&
      s.stageFrame <= this.maxFrame &&
      canJumpNow(s.stageFrame, s.player)
    ) {
      run.push(s)
      s = this.advance(s, false)
    }

    // この接地区間から「一度も跳ばずに走り続けた」ときの軌跡。
    // 拡張条項の判定に使う。区間内のどのフレームから見ても同一の経路なので1本で足りる
    const coast = this.coastPath(arrival)

    const runs: { from: number; to: number }[] = []
    let start = -1
    for (let i = 0; i < run.length; i++) {
      const ok = target !== INF && target > 0 && this.isUsefulTap(run[i], target, coast)
      if (ok) {
        if (start < 0) start = i
      } else if (start >= 0) {
        runs.push({ from: start, to: i - 1 })
        start = -1
      }
    }
    if (start >= 0) runs.push({ from: start, to: run.length - 1 })

    // 連続フレーム列の最大長。**和は取らない**（§14-① 縛り a）
    let window = 0
    for (const r of runs) window = Math.max(window, r.to - r.from + 1)

    const out: ArrivalWindows = { run, runs, window }
    this.memoArrival.set(key, out)
    return out
  }

  /**
   * 跳んだ直後の状態から、次にジャンプ可能になる状態まで進める。
   * 空中では選択肢が無いので一意に決まる。
   */
  nextArrival(sim: SimState): SimState | 'CLEARED' | 'DEAD' {
    let s = sim
    while (s.stageFrame <= this.maxFrame) {
      if (s.dead) return 'DEAD'
      if (s.cleared) return 'CLEARED'
      if (canJumpNow(s.stageFrame, s.player)) return s
      s = this.advance(s, false)
    }
    return 'DEAD'
  }
}

// ---------------------------------------------------------------------------
// マキシミン経路（ボトルネック最長路 DP）— GDD §14-① 縛り c
// ---------------------------------------------------------------------------

type MaximinNode = {
  /** この到達状態以降の最小生存窓の最大値 */
  value: number
  /** 選んだタップフレーム（-1 は「このルートではもう跳ばない」） */
  frame: number
  /** 選んだ連続列の長さ ＝ このジャンプの生存窓 */
  window: number
  first: number
  last: number
  /** その到達状態にあった有効タップ連続区間の本数（§14-9 の検証用） */
  runCount: number
}

function solveMaximin(search: Search, start: SimState): {
  route: RouteJump[]
  frames: number
  feasible: boolean
} {
  const memo = new Map<string, MaximinNode>()
  const NONE: MaximinNode = { value: -INF, frame: -1, window: 0, first: 0, last: 0, runCount: 0 }
  const DONE: MaximinNode = { value: INF, frame: -1, window: 0, first: 0, last: 0, runCount: 0 }

  const visit = (arrival: SimState): MaximinNode => {
    const key = stateKey(arrival)
    const hit = memo.get(key)
    if (hit) return hit
    memo.set(key, NONE) // 循環保険（実際は DAG）

    const target = search.minTaps(arrival)
    if (target === INF) {
      memo.set(key, NONE)
      return NONE
    }
    if (target === 0) {
      // もうタップせずにゴールできる
      memo.set(key, DONE)
      return DONE
    }

    const aw = search.arrivalWindows(arrival)
    let best = NONE

    if (aw.runs.length === 0) {
      // この接地区間では跳ばない。跳ばずに抜けた先の到達状態へ委ねる
      let s = arrival
      while (
        !s.dead &&
        !s.cleared &&
        s.stageFrame <= search.maxFrame &&
        canJumpNow(s.stageFrame, s.player)
      ) {
        s = search.advance(s, false)
      }
      const nxt = search.nextArrival(s)
      if (nxt === 'CLEARED') best = DONE
      else if (nxt !== 'DEAD') best = visit(nxt)
      memo.set(key, best)
      return best
    }

    for (const r of aw.runs) {
      const len = r.to - r.from + 1
      let inner = -INF
      let innerFrame = -1
      for (let i = r.from; i <= r.to; i++) {
        const jumped = search.advance(aw.run[i], true)
        const nxt = search.nextArrival(jumped)
        const v = nxt === 'CLEARED' ? INF : nxt === 'DEAD' ? -INF : visit(nxt).value
        if (v > inner) {
          inner = v
          innerFrame = aw.run[i].stageFrame
        }
      }
      if (inner === -INF) continue
      const value = Math.min(len, inner)
      if (value > best.value) {
        best = {
          value,
          frame: innerFrame,
          window: len,
          first: aw.run[r.from].stageFrame,
          last: aw.run[r.to].stageFrame,
          runCount: aw.runs.length,
        }
      }
    }

    memo.set(key, best)
    return best
  }

  const root = search.nextArrival(start)
  if (root === 'DEAD') return { route: [], frames: -1, feasible: false }
  if (root === 'CLEARED') return { route: [], frames: 0, feasible: true }
  const rootNode = visit(root)
  if (rootNode.value === -INF) return { route: [], frames: -1, feasible: false }

  // 経路を再構成する
  const route: RouteJump[] = []
  let cursor: SimState | 'CLEARED' | 'DEAD' = root
  let index = 0
  let guard = 0

  while (cursor !== 'CLEARED' && cursor !== 'DEAD' && guard++ < 2000) {
    const here: SimState = cursor
    const node = visit(here)
    if (node.frame < 0) {
      if (node.value === INF) break
      // この接地区間では跳ばずに抜ける
      let s: SimState = here
      while (
        !s.dead &&
        !s.cleared &&
        s.stageFrame <= search.maxFrame &&
        canJumpNow(s.stageFrame, s.player)
      ) {
        s = search.advance(s, false)
      }
      cursor = search.nextArrival(s)
      continue
    }

    // 選んだフレームまで跳ばずに進む
    let s: SimState = here
    while (s.stageFrame < node.frame) s = search.advance(s, false)

    index++
    route.push({
      index,
      frame: node.frame,
      first: node.first,
      last: node.last,
      window: node.window,
      at: progressRatio(search.stage, node.frame),
      groundedFrames: node.frame - s.player.groundedSince,
      chain: 1,
      runCount: node.runCount,
    })

    cursor = search.nextArrival(search.advance(s, true))
  }

  // 連鎖長を付与する（接地時間 12f 以下でつながるリンクの本数。GDD §14-③）
  let chain = 0
  for (let i = 0; i < route.length; i++) {
    if (i > 0 && route[i].groundedFrames <= CHAIN_GROUND_MAX) chain++
    else chain = 1
    route[i].chain = chain
  }

  // クリアまでのフレーム数を実測する
  const taps = new Set(route.map((j) => j.frame))
  const sim = createSim(search.stage)
  while (!sim.dead && !sim.cleared && sim.stageFrame <= search.maxFrame) {
    stepSim(search.stage, sim, taps.has(sim.stageFrame))
  }

  return { route, frames: sim.cleared ? sim.stageFrame : -1, feasible: sim.cleared }
}

// ---------------------------------------------------------------------------
// 副1: 最悪生存窓 / 副2: 詰み潜伏時間
// ---------------------------------------------------------------------------

/* ---------------------------------------------------------------------------
 * 誤帰属距離の「通過」判定（GDD §14-13 / 第3次裁定）
 *
 * カウント単位は **障害物オブジェクト（ObjDef）** である（§14-13-3）。
 * 旧単位「要求タップ地点」は、タップを要求しない天井（OB-04）が数から消えるため
 * **偽陰性（見逃し）** を生んでいた。くぐり抜けは強い突破体験であり、その後に死ねば
 * 確実に誤帰属が起きる。偽陰性は偽陽性より危険なので単位を改めた。
 *
 * 障害物 k をカウントするのは以下をすべて満たすときのみ。
 *   C1 対象   k が挑戦オブジェクトであること（`warn` と `spring` は対象外）
 *   C2 通過   致死ボックスの X 範囲が k の判定矩形の X 範囲を追い越したこと
 *   C3 無接触 重なり区間で k の判定矩形と一度も交差していないこと
 *   C4 正しい側 **重なり区間の全フレームにわたって**「意図された側」に居続けたこと
 *
 * C4 を全フレームで評価するのが要点。追い越した1フレームだけで見ると、
 * ブロックを越えた直後の下降フレームが「下を通った」と誤判定される。
 * 動体（lift / fly）は各フレームの判定矩形で解く（固定座標で評価しない）。
 * ------------------------------------------------------------------------- */

/** C1: 誤帰属距離のカウント対象になる挑戦オブジェクトか */
function isChallenge(kind: ObjKind): boolean {
  // `warn` は装飾マーカー、`spring` は非致死・入力不要で突破体験を生まない
  return kind !== 'warn' && kind !== 'spring'
}

/** 誤帰属距離の判定に使う矩形。致死物は判定矩形（インセット済）、それ以外は見た目どおり */
function gapRect(o: ResolvedObj): Rect {
  return killRect(o) ?? { x: o.x, y: o.y, w: o.w, h: o.h }
}

/**
 * C4:「意図された側」に居るか（GDD §14-13-2 のタイプ別定義）。
 * 原理は「落下・踏み抜きによる非意図的な通過は突破ではない」。
 */
function onIntendedSide(o: ResolvedObj, playerY: number, groundY: number): boolean {
  const r = gapRect(o)
  switch (o.kind) {
    // 上を越えた／上面に乗った（上面着地は必ずカウントする。S2・S3 の遅延死がこの形）
    // swing / spear も地上型（GDD §15-10-1）。動体は毎フレームの位置で解く
    case 'block':
    case 'lift':
    case 'spike':
    case 'plat':
    case 'crumble':
    case 'swing':
    case 'spear':
    // `drop` も地上型（GDD §16-6 / §14-13-2）。落ちる個体は毎フレーム位置が変わるので、
    // 「越えたか」はそのフレームの実位置で解く（§14-13-2 の統一原理）
    case 'drop':
      return lethalBottom(playerY) <= r.y
    /*
     * 穴に沈んでいない。
     *
     * 【§14-13-2 の字義（致死ボックス**上辺** < groundY）からの修正 — 実測に基づく】
     * 上辺で測ると、谷に落ちはじめてから X が谷の右端を追い越すまでの数フレームで
     * まだ上辺が groundY より上にあるため、**落下中なのに「突破した」と数えてしまう**。
     * S3 の谷 x=1250 で実際に偽陽性が出た（詰み f400 → 落下死 f419。プレイヤーは
     * 自分が穴に落ちる姿を見ており、誤帰属は起きていない）。
     * 他タイプと同じく**下辺**で測れば「足が地面より下にある＝沈んでいる」を正しく捉える。
     * 判定は §14-13-1 の原理「落下による非意図的な通過は突破ではない」そのままで、
     * 谷を跳び越して向こう岸に着地した本物の突破は引き続きカウントされる。
     */
    case 'pit':
      return lethalBottom(playerY) <= groundY + LANDING_TOLERANCE
    // 下をくぐった。天井を上から越える経路は物理的に存在しない
    case 'ceil':
      return lethalTop(playerY) >= r.y + r.h
    // 飛行体は上下どちらで避けても「避けた」と知覚するので側を指定しない
    case 'fly':
      return true
    default:
      return true
  }
}

/** ある stageFrame で、致死ボックスと X 範囲が重なっている挑戦オブジェクト */
function overlappingChallenges(
  stage: StageDef,
  sim: SimState,
): { index: number; ok: boolean }[] {
  const worldX = playerWorldX(stage, sim.stageFrame)
  const left = worldX + PLAYER_HITBOX_OX
  const right = left + PLAYER_HITBOX_W
  const out: { index: number; ok: boolean }[] = []
  // 動体もこのフレームの位置で解決される
  for (const o of resolveObjectsInRange(stage, sim.stageFrame, left - 128, right + 128, sim)) {
    if (!isChallenge(o.kind)) continue
    // 槍は伸長が始まっていない間は挑戦が成立していない（GDD §15-10-1）
    if (o.kind === 'spear' && !o.lethal) continue
    const r = gapRect(o)
    if (right <= r.x || left >= r.x + r.w) continue
    out.push({ index: o.index, ok: onIntendedSide(o, sim.player.y, stage.groundY) })
  }
  return out
}

/** 進行中の重なりの状態。key = 障害物の添字 / value = C4 がここまで成立しているか */
type ActiveOverlaps = Map<number, boolean>

function activeKey(a: ActiveOverlaps): string {
  if (a.size === 0) return ''
  return [...a.entries()].sort((x, y) => x[0] - y[0]).map(([i, ok]) => `${i}${ok ? '+' : '-'}`).join(',')
}

/**
 * 誤帰属距離を数える（GDD §14-13）。
 *
 * 詰み状態から **全継続ルートにわたる最大値** を採る（§14-13-4）。
 * 死ぬと分かっていない本人は粘って進もうとするので、最も遠くまで到達する継続こそが
 * 実際に起きる体験に近く、かつ検査として安全側（見逃しが出ない）である。
 */
function countBreakthroughs(search: Search, stage: StageDef, doom: SimState): number {
  const memo = new Map<string, number>()

  const walk = (sim: SimState, active: ActiveOverlaps, depth: number): number => {
    if (sim.dead || sim.cleared || sim.stageFrame > search.maxFrame || depth > 240) return 0
    const key = stateKey(sim) + '|' + activeKey(active)
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    memo.set(key, 0) // 循環保険（実際は DAG）

    // このフレームの重なりを解決し、C4 を積算する
    const now = overlappingChallenges(stage, sim)
    const nowMap = new Map(now.map((e) => [e.index, e.ok]))
    const next: ActiveOverlaps = new Map()
    let closed = 0
    for (const [idx, okSoFar] of active) {
      if (nowMap.has(idx)) continue // まだ重なっている（下で改めて積む）
      // 重なり区間が終了した ＝ C2 成立。C4 が全フレームで成立していればカウント
      if (okSoFar) closed++
    }
    for (const [idx, okNow] of nowMap) {
      const prev = active.get(idx)
      next.set(idx, prev === undefined ? okNow : prev && okNow)
    }

    let best = 0
    const noJump = search.advance(sim, false)
    best = walk(noJump, next, depth + 1)
    if (canJumpNow(sim.stageFrame, sim.player)) {
      const jumped = search.advance(sim, true)
      const v = walk(jumped, next, depth + 1)
      if (v > best) best = v
    }

    const total = closed + best
    memo.set(key, total)
    return total
  }

  // 詰みフレーム時点で既に重なっている障害物は、その時点の C4 を初期値にする
  const initial: ActiveOverlaps = new Map()
  for (const e of overlappingChallenges(stage, doom)) initial.set(e.index, e.ok)
  return walk(doom, initial, 0)
}

/** 生存窓（最大連続列）の先頭フレーム */
function windowStartFrame(aw: ArrivalWindows): number {
  let best = aw.runs[0]
  for (const r of aw.runs) if (r.to - r.from > best.to - best.from) best = r
  return aw.run[best.from].stageFrame
}

function scanReachable(
  search: Search,
  stage: StageDef,
): {
  worstWindow: number
  worstWindowAt: number
  maxMisattribGap: number
  maxDeadEndCtrl: number
  maxDeadEndRaw: number
  misattribHits: DeadEnd[]
  ctrlHits: DeadEnd[]
} {
  let worstWindow = INF
  let worstWindowAt = 0
  let maxMisattribGap = 0
  let maxDeadEndCtrl = 0
  let maxDeadEndRaw = 0
  const misattribHits: DeadEnd[] = []
  const ctrlHits: DeadEnd[] = []

  const seen = new Set<string>()
  const start = createSim(stage)
  let queue: SimState[] = [start]
  seen.add(stateKey(start))

  while (queue.length > 0) {
    const next: SimState[] = []
    for (const s of queue) {
      if (s.dead || s.cleared || s.stageFrame > search.maxFrame) continue
      if (!search.inW(s)) continue

      // 到達状態＝着地した瞬間（接地区間の先頭）。ここで生存窓を測る（縛り b）
      if (s.player.state === 'GROUNDED' && s.player.groundedSince === s.stageFrame) {
        const aw = search.arrivalWindows(s)
        if (aw.runs.length > 0 && aw.window < worstWindow) {
          worstWindow = aw.window
          worstWindowAt = progressRatio(stage, windowStartFrame(aw))
        }
      }

      const actions: boolean[] = canJumpNow(s.stageFrame, s.player) ? [false, true] : [false]
      for (const a of actions) {
        const n = search.advance(s, a)
        if (n.dead) continue
        if (!search.inW(n)) {
          // 勝利領域から外れた（＝ここで詰んだ）
          const prof = search.survivalProfile(n)
          const deathFrame = n.stageFrame + prof.frames
          // 検査5: 誤帰属距離 ＝ 詰み〜死亡の間に通過した要求タップ地点の数
          const misattrib = countBreakthroughs(search, stage, n)
          const de: DeadEnd = {
            frame: n.stageFrame,
            deathFrame,
            raw: prof.frames,
            ctrl: prof.ctrl,
            misattrib,
            at: progressRatio(stage, n.stageFrame),
          }
          if (prof.frames > maxDeadEndRaw) maxDeadEndRaw = prof.frames
          if (prof.ctrl > maxDeadEndCtrl) maxDeadEndCtrl = prof.ctrl
          if (misattrib > maxMisattribGap) maxMisattribGap = misattrib
          if (misattrib > MISATTRIB_GAP_MAX && misattribHits.length < 5) misattribHits.push(de)
          if (prof.ctrl > DEADEND_CTRL_WARN && ctrlHits.length < 5) ctrlHits.push(de)
          continue
        }
        const k = stateKey(n)
        if (!seen.has(k)) {
          seen.add(k)
          next.push(n)
        }
      }
    }
    queue = next
  }

  return {
    worstWindow: worstWindow === INF ? 0 : worstWindow,
    worstWindowAt,
    maxMisattribGap,
    maxDeadEndCtrl,
    maxDeadEndRaw,
    misattribHits,
    ctrlHits,
  }
}

// ---------------------------------------------------------------------------
// 区間難度 D(t)（GDD §14-④）
// ---------------------------------------------------------------------------

function climaxOf(
  stage: StageDef,
  route: RouteJump[],
  limitFrame: number,
): { d: number; at: number } {
  if (route.length === 0) return { d: 0, at: 0 }
  const pts = route
    .map((j) => ({ f: j.frame, w: CLIMAX_NORM_FRAMES / Math.max(1, j.window) }))
    .sort((a, b) => a.f - b.f)

  let bestD = 0
  let bestT = -1
  let lo = 0
  let hi = 0
  let sum = 0

  for (let t = 0; t <= limitFrame; t++) {
    const end = t + CLIMAX_WINDOW_FRAMES
    while (hi < pts.length && pts[hi].f < end) sum += pts[hi++].w
    while (lo < hi && pts[lo].f < t) sum -= pts[lo++].w
    // 同値は後方優先（GDD §14-④ のタイブレーク）
    if (sum > 0 && sum >= bestD) {
      bestD = sum
      bestT = t
    }
  }
  if (bestT < 0) return { d: 0, at: 0 }
  return {
    d: bestD,
    at: progressRatio(stage, bestT + CLIMAX_WINDOW_FRAMES / 2),
  }
}

// ---------------------------------------------------------------------------
// ステージを解く
// ---------------------------------------------------------------------------

export function solveStage(stage: StageDef, windowMinFrames = 10): SolveResult {
  const search = new Search(stage)
  const start = createSim(stage)
  const total = search.minTaps(start)

  const empty: SolveResult = {
    feasible: false,
    frames: -1,
    taps: -1,
    route: [],
    minWindow: 0,
    minWindowAt: 0,
    worstWindow: 0,
    worstWindowAt: 0,
    maxMisattribGap: 0,
    maxDeadEndCtrl: 0,
    maxDeadEndRaw: 0,
    misattribHits: [],
    ctrlHits: [],
    maxChain: 0,
    breathViolations: [],
    tightDensity: 0,
    suppressRatio: 0,
    compositeRatio: 0,
    tapsPerSecond: 0,
    expectedDeaths: 0,
    expectedDeathsBySigma: SIGMA_POINTS.map((sigma) => ({ sigma, value: 0 })),
    clearProbability: 1,
    seconds: 0,
    climaxD: 0,
    climaxAt: 0,
    statesExplored: search.states,
    arrivalsAnalyzed: 0,
  }
  if (total === INF) return empty

  const mm = solveMaximin(search, start)
  if (!mm.feasible) return { ...empty, statesExplored: search.states }

  let minWindow = INF
  let minWindowAt = 0
  for (const j of mm.route) {
    if (j.window < minWindow) {
      minWindow = j.window
      minWindowAt = j.at
    }
  }
  if (mm.route.length === 0) minWindow = 0

  // チェイン長と息継ぎ規定（GDD §14-③）
  let maxChain = 0
  for (const j of mm.route) if (j.chain > maxChain) maxChain = j.chain

  const breathViolations: number[] = []
  for (let i = 0; i < mm.route.length; i++) {
    const isChainEnd =
      mm.route[i].chain >= BREATH_TRIGGER_CHAIN &&
      (i + 1 >= mm.route.length || mm.route[i + 1].chain === 1)
    if (!isChainEnd) continue
    const nextJump = mm.route[i + 1]
    // 連鎖終端の次のタップまでの接地時間（次が無ければゴールまで＝十分）
    if (nextJump && nextJump.groundedFrames < BREATH_MIN) {
      breathViolations.push(nextJump.at)
    }
  }

  const scan = scanReachable(search, stage)
  const climax = climaxOf(stage, mm.route, goalFrame(stage))
  const metrics = stageMetrics(stage, mm.route, windowMinFrames)
  const seconds = stage.lengthPx / stage.speedPxPerFrame / 60
  // 推奨ルート上の全タップの生存窓。これがそのまま E[D] の入力になる
  const routeWindows = mm.route.map((r) => r.window)
  const ed = expectedDeaths(routeWindows, SIGMA_MS)

  return {
    feasible: true,
    frames: mm.frames,
    taps: total,
    route: mm.route,
    minWindow,
    minWindowAt,
    worstWindow: scan.worstWindow,
    worstWindowAt: scan.worstWindowAt,
    maxMisattribGap: scan.maxMisattribGap,
    maxDeadEndCtrl: scan.maxDeadEndCtrl,
    maxDeadEndRaw: scan.maxDeadEndRaw,
    misattribHits: scan.misattribHits,
    ctrlHits: scan.ctrlHits,
    maxChain,
    breathViolations,
    tightDensity: metrics.tightDensity,
    suppressRatio: metrics.suppressRatio,
    compositeRatio: metrics.compositeRatio,
    tapsPerSecond: seconds > 0 ? mm.route.length / seconds : 0,
    // E[D]: 推奨ルート上の全タップの生存窓の積。新しい探索は不要（§16-7）
    expectedDeaths: ed.expected,
    clearProbability: ed.clearProbability,
    expectedDeathsBySigma: SIGMA_POINTS.map((sigma) => ({
      sigma,
      value: expectedDeaths(routeWindows, sigma).expected,
    })),
    seconds,
    climaxD: climax.d,
    climaxAt: climax.at,
    statesExplored: search.states,
    arrivalsAnalyzed: search.arrivals,
  }
}

// ---------------------------------------------------------------------------
// 新指標（GDD §15-7-3）
// ---------------------------------------------------------------------------

/**
 * 速度と平均タップ密度は S10 でほぼ上限に達する（理論上限 1.44 タップ/秒）。
 * S11 以降の難化は「窓を狭める」のではなく「狭い箇所を増やす」ことで行うため、
 * それを測る指標を3つ持つ（§15-7-2）。
 */
function stageMetrics(
  stage: StageDef,
  route: RouteJump[],
  windowMinFrames: number,
): { tightDensity: number; suppressRatio: number; compositeRatio: number } {
  const seconds = stage.lengthPx / stage.speedPxPerFrame / 60

  // 狭窓密度: 生存窓が「章の下限 + 2f」以下のジャンプ本数 / ステージ長(秒)
  const threshold = tightWindowThreshold(windowMinFrames)
  const tight = route.filter((j) => j.window <= threshold).length
  const tightDensity = seconds > 0 ? tight / seconds : 0

  // 抑制率: 「跳んではいけない障害物」の数 / 全挑戦オブジェクト数
  // 跳んではいけないもの = 天井（くぐる）/ MID 高度の飛行体（立ったまま通す）/
  // 落ちない drop（その高さが塞がるので**下を通る**・§16-6）
  const challenges = stage.objects.filter((o) => isChallenge(o.t))
  const suppress = challenges.filter(
    (o) => o.t === 'ceil' || (o.t === 'fly' && o.alt === 'MID') || (o.t === 'drop' && !o.falls),
  ).length
  const suppressRatio = challenges.length > 0 ? suppress / challenges.length : 0

  // 複合度: 複合パターン（P-B くぐり抜け / P-F 位相 / P-G 全部 / P-H 位相群）に
  // 該当する区間の長さ合計 / ステージ長。
  // 該当区間は「動体・天井を含む障害物が 2.0 秒窓の中に 2 つ以上ある」範囲とする
  const span = stage.speedPxPerFrame * 60 * 2.0
  const marks = challenges
    .filter(
      (o) =>
        o.t === 'ceil' ||
        o.t === 'fly' ||
        o.t === 'lift' ||
        o.t === 'swing' ||
        o.t === 'spear' ||
        o.t === 'drop',
    )
    .map((o) => o.x)
    .sort((a, b) => a - b)
  let covered = 0
  let i = 0
  while (i < marks.length) {
    let j = i
    while (j + 1 < marks.length && marks[j + 1] - marks[i] <= span) j++
    if (j > i) {
      covered += marks[j] - marks[i]
      i = j + 1
    } else {
      i++
    }
  }
  const compositeRatio = stage.lengthPx > 0 ? covered / stage.lengthPx : 0

  return { tightDensity, suppressRatio, compositeRatio }
}

// ---------------------------------------------------------------------------
// 静的検査（GDD §7-4 検査6・8 / §5-3）
// ---------------------------------------------------------------------------

/** 着地できる x 区間（地面の残っている部分＋足場類）をマージして返す */
function landableIntervals(stage: StageDef): { x: number; end: number }[] {
  const raw: { x: number; end: number }[] = []
  const pits = stage.objects
    .filter((o): o is Extract<typeof o, { t: 'pit' }> => o.t === 'pit')
    .map((o) => ({ x: o.x, end: o.x + o.w }))
    .sort((a, b) => a.x - b.x)

  let cursor = 0
  for (const p of pits) {
    if (p.x > cursor) raw.push({ x: cursor, end: p.x })
    cursor = Math.max(cursor, p.end)
  }
  raw.push({ x: cursor, end: stage.lengthPx + 320 })

  for (const o of stage.objects) {
    if (o.t === 'plat') raw.push({ x: o.x, end: o.x + PLAT_W })
    else if (o.t === 'crumble') raw.push({ x: o.x, end: o.x + CRUMBLE_W })
    else if (o.t === 'lift') raw.push({ x: o.x, end: o.x + LIFT_W })
    else if (o.t === 'block') raw.push({ x: o.x, end: o.x + o.w })
  }

  raw.sort((a, b) => a.x - b.x)
  const merged: { x: number; end: number }[] = []
  for (const r of raw) {
    const last = merged[merged.length - 1]
    if (last && r.x <= last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ ...r })
  }
  return merged
}

/**
 * ブロックの高さ検査。**引数の型を `BlockObj` に固定してあるのが本体である。**
 *
 * §5-3 の上限 40px は §15-3 で撤廃され、`h >= 56` は WALL（G2）として扱う。
 * 禁止帯 `40 < h < 56` は次の2つの理由で塞ぐ。
 *
 *  1. 単発では越えられないのに踏み台規定（W1〜W5）も掛からない無主地帯である
 *  2. **より重い理由**: この帯の静止ブロックは高い槍とほぼ同じ狭い窓を持ちながら、
 *     `spear` に課した `warn` マーカーと伏せ状態の可視性を回避できる。
 *     **予告なしの槍をただのブロックとして密輸できる抜け道**になる
 *
 * 【型で分離している理由 — これを実行時条件に頼ってはならない】
 * `spear` の設計域は `h` 40〜54 で、**この禁止帯と完全に重なる**。
 * 誤って `spear` に適用すると G4 が丸ごと成立しなくなる。
 * 引数型を `BlockObj` にしておけば、`SpearObj` を渡した時点でコンパイルが通らない。
 */
function blockHeightIssues(o: BlockObj): CheckIssue[] {
  if (o.h > OBSTACLE_MAX_H && o.h < WALL_MIN_H) {
    return [
      {
        level: 'FAIL',
        code: 'OBJ_H',
        message: `ブロックの高さ ${o.h}px が禁止帯（通常上限 ${OBSTACLE_MAX_H}px 超 〜 WALL 下限 ${WALL_MIN_H}px 未満）にあります (x=${o.x})。単発で越えられず踏み台規定も掛からないうえ、予告なしの槍をブロックとして密輸できる`,
      },
    ]
  }
  return []
}

/**
 * §5-3 に新設された配置上限（GDD §15-14）。
 *
 * - トゲ床の幅 `8n <= 水平到達距離 x 0.85`。**上面に乗れない唯一の高さ持ち障害物**であり、
 *   幅で窓を締められる代わりに、伸ばしすぎると突破不能になる
 * - **同一 worldX 区間に着地可能面を3つ以上重ねない**（2つまで＝本線＋迂回）
 * - **同時に起動中になりうる崩落床は3個以下**
 *
 * 後ろ2条は探索の状態爆発を防ぐための技術的制約であると同時に、設計原則としても正しい。
 * 本作は1本の正解ラインを暗記するゲームで、3本以上のルートが並ぶと暗記の対象が発散する。
 * **検査できない設計は、たいてい遊べない設計でもある。**
 */
function catalogLimits(stage: StageDef): CheckIssue[] {
  const issues: CheckIssue[] = []
  const pairs = gatePairs(stage)
  const gateLowers = new Set([...pairs.values()].map((i) => (stage.objects[i] as { x: number }).x))
  const reach = horizontalReach(stage.speedPxPerFrame)

  // トゲ床の幅
  const spikeMax = Math.floor((reach * SPIKE_MAX_WIDTH_RATIO) / SPIKE_UNIT)
  for (const o of stage.objects) {
    if (o.t !== 'spike') continue
    if (o.n > spikeMax) {
      issues.push({
        level: 'FAIL',
        code: 'SPIKE_N',
        message: `トゲ床の連数 ${o.n}（幅 ${o.n * SPIKE_UNIT}px）が上限 ${spikeMax}（幅 ${spikeMax * SPIKE_UNIT}px＝水平到達 ${reach} x ${SPIKE_MAX_WIDTH_RATIO}）を超えます (x=${o.x})`,
      })
    }
  }

  // 着地可能面の重なり
  type Seg = { x0: number; x1: number; label: string }
  const segs: Seg[] = []
  for (const o of stage.objects) {
    if (o.t === 'block') segs.push({ x0: o.x, x1: o.x + o.w, label: `block@${o.x}` })
    else if (o.t === 'plat') segs.push({ x0: o.x, x1: o.x + PLAT_W, label: `plat@${o.x}` })
    else if (o.t === 'crumble') segs.push({ x0: o.x, x1: o.x + CRUMBLE_W, label: `crumble@${o.x}` })
    else if (o.t === 'lift') segs.push({ x0: o.x, x1: o.x + LIFT_W, label: `lift@${o.x}` })
    else if (o.t === 'swing') {
      // 横に振れるので可動域の全幅を占有するものとして数える
      segs.push({ x0: o.x, x1: o.x + o.amp + SWING_W, label: `swing@${o.x}` })
    }
  }
  const pits = stage.objects
    .filter((o): o is Extract<typeof o, { t: 'pit' }> => o.t === 'pit')
    .map((o) => ({ x0: o.x, x1: o.x + o.w }))
  const groundSolid = (x: number) => !pits.some((p) => x >= p.x0 && x < p.x1)
  const edges = new Set<number>()
  for (const g2 of segs) { edges.add(g2.x0); edges.add(g2.x1) }
  for (const x of [...edges].sort((a, b) => a - b)) {
    const over = segs.filter((g2) => x >= g2.x0 && x < g2.x1)
    const count = over.length + (groundSolid(x) ? 1 : 0)
    if (count > MAX_OVERLAPPING_SURFACES) {
      issues.push({
        level: 'FAIL',
        code: 'SURFACES',
        message: `worldX=${x} に着地可能面が ${count} 枚重なっています（上限 ${MAX_OVERLAPPING_SURFACES}＝本線＋迂回）: ${over.map((g2) => g2.label).join(', ')}${groundSolid(x) ? ', 地面' : ''}`,
      })
      break
    }
  }

  // 同時に起動中になりうる崩落床
  const crumbles = stage.objects.filter((o): o is Extract<typeof o, { t: 'crumble' }> => o.t === 'crumble')
  if (crumbles.length > 0) {
    const liveSpan = (CRUMBLE_DELAY + CRUMBLE_FALL_FRAMES) * stage.speedPxPerFrame
    for (let i = 0; i < crumbles.length; i++) {
      let n = 1
      for (let j = i + 1; j < crumbles.length; j++) {
        if (crumbles[j].x - crumbles[i].x <= liveSpan) n++
      }
      if (n > MAX_CONCURRENT_CRUMBLE) {
        issues.push({
          level: 'FAIL',
          code: 'CRUMBLE_N',
          message: `x=${crumbles[i].x} から ${Math.round(liveSpan)}px（起動中の ${CRUMBLE_DELAY + CRUMBLE_FALL_FRAMES}f）の範囲に崩落床が ${n} 個あります（上限 ${MAX_CONCURRENT_CRUMBLE}）`,
        })
        break
      }
    }
  }

  return issues
}

/**
 * 標準正規分布の累積分布関数 Φ。Abramowitz & Stegun 26.2.17（誤差 < 7.5e-8）。
 * `E[D]` の算出にしか使わないので、この精度で足りる。
 */
export function phi(z: number): number {
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/**
 * 生存窓 W[frames] の 1 タップ失敗確率。`p = 2(1 - Φ(W / 2σ))`（GDD §16-1）。
 *
 * タップ時刻の誤差が平均0・標準偏差 σ の正規分布に従い、窓の中心を狙うと仮定する。
 * 窓の外に出れば死ぬので、両側の裾を足して 2 倍している。
 */
export function tapFailProbability(windowFrames: number, sigmaMs: number): number {
  const wMs = (windowFrames / 60) * 1000
  return Math.max(0, Math.min(1, 2 * (1 - phi(wMs / (2 * sigmaMs)))))
}

/**
 * 期待死亡回数 `E[D] = 1/Π(1-p_i) - 1`（GDD §16-7）。
 *
 * **新しい探索は要らない。** ソルバは既に推奨ルート上の全タップの生存窓を持っているので、
 * 積を取るだけで出る。**これが唯一、人間側の実測量（σ）に接続された指標**であり、
 * 旧設計の「10本すべて無死亡クリア」を事前に検出できた唯一の検査でもある
 * （旧10本の E[D] 合計は約 0.5 回だった）。
 */
export function expectedDeaths(
  windows: readonly number[],
  sigmaMs: number,
): { expected: number; clearProbability: number } {
  let logP = 0
  for (const w of windows) {
    const p = tapFailProbability(w, sigmaMs)
    // p = 1 なら通しクリア確率 0。E[D] は発散するので有限の巨大値で打ち切る
    if (p >= 1) return { expected: Infinity, clearProbability: 0 }
    logP += Math.log(1 - p)
  }
  const clear = Math.exp(logP)
  return { expected: 1 / clear - 1, clearProbability: clear }
}

/**
 * `GATE`（門・GDD §16-10）を成す組を返す。
 *
 * **新タイプではない。** 同一 X 範囲に「下段の障害物（block / spear / pit）」と
 * 「上段の `ceil`」を重ねただけのもので、隙間 `B` px が窓を決める。
 *
 *   窓[f] = 2*sqrt(B / (G/2))
 *
 * **この式に速度が入らない。** 垂直方向の通過条件だけで決まるので、
 * **全速度域で 1px 刻みに窓を刻める。** 高速域では §6-1 の第2項 `(pw+ow)/v` が
 * 速度に反比例するため単体の静止障害物は必ず易しくなり、6f を作るには
 * 「2タップを短時間に要求する複合」しか無く、それは通常誤帰属を生む。
 * 例外が**要素どうしが X 範囲で密着した「溶接された複合」**で、
 * これまで WALL+STEP の1種類しか無かった。
 *
 * 戻り値は `ceil` の添字 → 下段の添字。
 */
export function gatePairs(stage: StageDef): Map<number, number> {
  const out = new Map<number, number>()
  stage.objects.forEach((c, ci) => {
    if (c.t !== 'ceil') return
    stage.objects.forEach((o, oi) => {
      if (oi === ci) return
      const w = o.t === 'block' ? o.w : o.t === 'pit' ? o.w : o.t === 'spear' ? SPEAR_VIS_W : -1
      if (w < 0) return
      // X 範囲が重なっていれば門とみなす
      if (o.x < c.x + c.w && c.x < o.x + w) out.set(ci, oi)
    })
  })
  return out
}

/** `GATE` の隙間 B[px]（`ceil` 下辺と下段上辺のあいだから、致死ボックス高さを引いた通過幅） */
/** `ceil` の添字から下段の添字を引く。無ければ -1 */
export function gateLowerOf(stage: StageDef, ceilIndex: number): number {
  return gatePairs(stage).get(ceilIndex) ?? -1
}

export function gateGap(stage: StageDef, ceilIndex: number, lowerIndex: number): number {
  const c = stage.objects[ceilIndex] as { y: number }
  const o = stage.objects[lowerIndex]
  const top =
    o.t === 'block' ? stage.groundY - o.h
    : o.t === 'spear' ? stage.groundY - Math.max(0, o.h - SPEAR_TIP_INSET)
    : stage.groundY
  return top - (c.y + CEIL_H) - PLAYER_HITBOX_H
}

/**
 * 狭窓（生存窓 <= threshold）を**ユニット種別に**数える（GDD §16-10 #3）。
 *
 * 難易度の出所が1種類に偏ることを検査するため。`WALL`（h>=56 のブロック）と
 * `GATE`（`ceil` + 下段）は複合なので、構成要素の型ではなく複合の名前で数える。
 */
export function tightUnitKinds(
  stage: StageDef,
  route: readonly RouteJump[],
  threshold: number,
): Map<string, number> {
  const gates = gatePairs(stage)
  const gateMembers = new Set<number>()
  for (const [c, o] of gates) { gateMembers.add(c); gateMembers.add(o) }
  // WALL は「踏み台 + 壁」の複合なので、踏み台側を踏んでも WALL として数える
  const stepOfWall = new Set<number>()
  stage.objects.forEach((o, i) => {
    if (o.t !== 'block' || o.h < WALL_MIN_H) return
    stage.objects.forEach((q, j) => {
      if (q.t !== 'block' || j === i) return
      if (q.x + q.w >= o.x - 16 && q.x < o.x) stepOfWall.add(j)
    })
  })
  const kindOf = (i: number): string => {
    const o = stage.objects[i]
    if (gateMembers.has(i)) return 'GATE'
    if (o.t === 'block' && (o.h >= WALL_MIN_H || stepOfWall.has(i))) return 'WALL'
    return o.t
  }
  const out = new Map<string, number>()
  for (const j of route) {
    if (j.window > threshold) continue
    const x0 = playerWorldX(stage, j.frame)
    const x1 = playerWorldX(stage, j.frame + Math.ceil(JUMP_AIRTIME)) + PLAYER_HITBOX_W
    let pick = -1
    stage.objects.forEach((o, i) => {
      if (!isChallenge(o.t)) return
      const w = o.t === 'block' ? o.w : o.t === 'pit' ? o.w : o.t === 'spike' ? o.n * SPIKE_UNIT : o.t === 'ceil' ? o.w : 16
      if (o.x + w < x0 || o.x > x1) return
      if (pick < 0 || o.x < stage.objects[pick].x) pick = i
    })
    if (pick < 0) continue
    const k = kindOf(pick)
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}

/**
 * 知識由来の死 `D_knowledge`。**初見でのみ発生し、2周目以降は起きない死の本数。**
 *
 * σ（タップ精度）に由来しないので、σ ベースの `E[D_skill]` では原理的に捉えられない。
 * 混ぜると何を測っているか分からなくなるため、**別枠で数える**。
 *
 * 現時点の該当は「予兆なし `drop`」だけ。一般則は
 * **「初見でのみ観測不能」は許可 / 「何周しても観測不能」は禁止**で、
 * 前者は死因が「覚えていなかった」でプレイヤーに帰属＝初見殺し、
 * 後者は「観測できなかった」で設計に帰属＝理不尽。憲法2 が禁じているのは後者だけ。
 */
export function knowledgeDeaths(stage: StageDef): number {
  return stage.objects.filter((o) => o.t === 'drop' && o.falls && o.tell === false).length
}

/**
 * 平均要求タップ/秒の**構造上限**。連鎖上限 c と息継ぎ規定から一意に決まる。
 *
 * 1本のジャンプは滞空 41.67f を要し、連鎖中の接地は最大 CHAIN_GROUND_MAX(12f)。
 * c 本跳んだら連鎖を切らねばならず、その接地は c>=4 なら BREATH_MIN(30f)、
 * それ未満でも 13f（12f 超）が要る。よって 1 周期 = c*41.67 + (c-1)*12 + 切り、
 * タップは c 本。これが**理論最大**で、安全走路・予告距離・抑制オブジェクトを
 * 一切置かない前提の値だから、実際に到達できるのはこの 6〜7割にとどまる。
 */
export function tapsPerSecondCeiling(maxChain: number): number {
  const c = Math.max(1, maxChain)
  const brk = c >= 4 ? BREATH_MIN : CHAIN_GROUND_MAX + 1
  return (c / (c * JUMP_AIRTIME + (c - 1) * CHAIN_GROUND_MAX + brk)) * 60
}

/**
 * 平均要求タップ/秒の**実効上限**（章ごと）。
 *
 * 理論最大（連鎖3 のときの 1.11 /秒）に `(1 - 章の抑制率上限)` を掛ける。
 * 抑制オブジェクトは**時間を消費してタップを生まない**ので、
 * 抑制率を上げる設計＝密度の上限を下げる設計になっている。
 * I 1.00 / II 0.89 / III 0.83 / IV 0.78 / V 0.72 / VI 0.67。
 */
export function effectiveTapsPerSecondCeiling(chapter: number): number {
  const c = Math.min(CHAPTER_SUPPRESS_MAX.length - 1, Math.max(0, chapter))
  return tapsPerSecondCeiling(3) * (1 - CHAPTER_SUPPRESS_MAX[c])
}

/**
 * クライマックス帯（85〜95%）にある谷を列挙する。
 * 谷は後続の安全間隔を 1.9R 押し広げるため、そこが最も疎になり D(t) のピークが前へずれる。
 * **通っているステージには出さない。** 検査9（D(t) ピーク）が不合格のときにだけ、
 * その原因として添える。通っているものに警告を出し続ける検査は狼少年になり、
 * 本当の警告を薄めるため（GDD §15-15）。
 */
function pitsInClimax(stage: StageDef): number[] {
  return stage.objects
    .filter((o) => o.t === 'pit')
    .map((o) => o.x)
    .filter((x) => {
      const at = x / stage.lengthPx
      return at >= CLIMAX_MIN_RATIO && at <= CLIMAX_MAX_RATIO
    })
}

/**
 * G2 WALL の幾何規定 W1〜W5（GDD §15-3）。
 *
 * `h >= 56` の block を WALL と呼ぶ。単発ジャンプ（頂点 52.08px）では絶対に越えられず、
 * **手前の踏み台に乗ってから跳ぶ以外に突破経路が無い**。
 * 踏み台が細いと2段ジャンプ全体が1つのフレームパーフェクト動作に潰れ、
 * 憲法1 の「WHEN」が「運」に変わるため、接地時間を W3 で確保する。
 */
function wallChecks(stage: StageDef): CheckIssue[] {
  const issues: CheckIssue[] = []
  const reach = horizontalReach(stage.speedPxPerFrame)
  const minStepW = Math.ceil(WALL_STEP_MIN_GROUND_FRAMES * stage.speedPxPerFrame - PLAYER_HITBOX_W)

  for (const o of stage.objects) {
    if (o.t !== 'block' || o.h < WALL_MIN_H) continue

    // 直前の踏み台（block / plat）を探す
    let step: { x: number; right: number; h: number; w: number } | null = null
    for (const c of stage.objects) {
      if (c.x >= o.x) continue
      if (c.t === 'block' && c.h < WALL_MIN_H) {
        step = { x: c.x, right: c.x + c.w, h: c.h, w: c.w }
      } else if (c.t === 'plat') {
        step = { x: c.x, right: c.x + PLAT_W, h: stage.groundY - c.y, w: PLAT_W }
      }
    }

    if (!step) {
      issues.push({
        level: 'FAIL',
        code: 'WALL_NO_STEP',
        message: `WALL(h=${o.h}, x=${o.x}) の手前に踏み台がありません。単発では越えられないため突破不能`,
      })
      continue
    }
    // W2: 踏み台上からの実効上限
    if (o.h > step.h + WALL_STEP_HEADROOM) {
      issues.push({
        level: 'FAIL',
        code: 'WALL_H',
        message: `WALL(h=${o.h}, x=${o.x}) が踏み台高さ ${step.h}px + ${WALL_STEP_HEADROOM}px を超えます（W2）`,
      })
    }
    // W3: 踏み台の接地時間（最低 8f）
    if (step.w < minStepW) {
      issues.push({
        level: 'FAIL',
        code: 'WALL_STEP_W',
        message: `踏み台の幅 ${step.w}px が下限 ${minStepW}px を下回ります（W3・最低 ${WALL_STEP_MIN_GROUND_FRAMES}f の接地）。細いと2段ジャンプがフレームパーフェクトに潰れ WHEN が運に変わる`,
      })
    }
    // W4: 踏み台 → WALL の水平間隔
    const d = o.x - step.right
    if (d > Math.floor(reach * PIT_MAX_RATIO)) {
      issues.push({
        level: 'FAIL',
        code: 'WALL_GAP',
        message: `踏み台 → WALL の間隔 ${d}px が上限 ${Math.floor(reach * PIT_MAX_RATIO)}px を超えます（W4）`,
      })
    }
    // W5: 踏み台の直前に warn マーカー
    const hasWarn = stage.objects.some((w) => w.t === 'warn' && w.x < step.x && step.x - w.x <= 400)
    if (!hasWarn) {
      issues.push({
        level: 'FAIL',
        code: 'WALL_WARN',
        message: `WALL(x=${o.x}) の踏み台の手前に §7-3 ルールB の warn マーカーがありません（W5）`,
      })
    }
  }
  return issues
}

export function staticChecks(stage: StageDef, budget: StageBudget): CheckIssue[] {
  const issues: CheckIssue[] = []
  const reach = horizontalReach(stage.speedPxPerFrame)
  const pairs = gatePairs(stage)
  // GATE の下段になっている槍は、窓が隙間 B で決まるので単体の解析窓は当てない
  const gateLowers = new Set([...pairs.values()].map((i) => (stage.objects[i] as { x: number }).x))

  // 検査8: worldX 昇順（描画カリングの前提）
  for (let i = 1; i < stage.objects.length; i++) {
    if (stage.objects[i].x < stage.objects[i - 1].x) {
      issues.push({
        level: 'FAIL',
        code: 'SORT',
        message: `objects が worldX 昇順ではありません: #${i - 1}(x=${stage.objects[i - 1].x}) > #${i}(x=${stage.objects[i].x})`,
      })
      break
    }
  }

  // 検査8: 安全走路（GDD §6-2）
  const expectedRunway = Math.max(120, Math.ceil(stage.speedPxPerFrame * 60 * 0.8))
  if (stage.safeRunwayPx < expectedRunway) {
    issues.push({
      level: 'FAIL',
      code: 'RUNWAY_DEF',
      message: `safeRunwayPx=${stage.safeRunwayPx} が規定値 ${expectedRunway} を下回っています`,
    })
  }
  for (const o of stage.objects) {
    if (o.x < stage.safeRunwayPx) {
      issues.push({
        level: 'FAIL',
        code: 'RUNWAY',
        message: `安全走路 ${stage.safeRunwayPx}px 以内に障害物があります: ${o.t} x=${o.x}`,
      })
      break
    }
  }

  // 検査6: 配置上限（GDD §5-3）
  const pitMax = Math.floor(reach * PIT_MAX_RATIO)
  for (const o of stage.objects) {
    if (o.t === 'pit') {
      if (o.w < PIT_MIN_W) {
        issues.push({
          level: 'FAIL',
          code: 'PIT_MIN',
          message: `谷の幅 ${o.w}px が最小 ${PIT_MIN_W}px を下回ります (x=${o.x})`,
        })
      }
      if (o.w > pitMax) {
        issues.push({
          level: 'FAIL',
          code: 'PIT_MAX',
          message: `谷の幅 ${o.w}px が上限 ${pitMax}px（水平到達 ${reach} x 0.90）を超えます (x=${o.x})`,
        })
      }
    }
    // ブロックの高さ。**`block` 型にしか適用しない**（下の関数が型で保証する）
    if (o.t === 'block') issues.push(...blockHeightIssues(o))
    // OB-11 swing のパラメータ範囲（GDD §15-2）
    if (o.t === 'swing') {
      if (o.amp < SWING_AMP_MIN || o.amp > SWING_AMP_MAX) {
        issues.push({
          level: 'FAIL',
          code: 'SWING_AMP',
          message: `swing の振幅 ${o.amp}px が範囲 ${SWING_AMP_MIN}〜${SWING_AMP_MAX} の外です (x=${o.x})`,
        })
      }
      if (o.period < SWING_PERIOD_MIN || o.period > SWING_PERIOD_MAX) {
        issues.push({
          level: 'FAIL',
          code: 'SWING_PERIOD',
          message: `swing の周期 ${o.period}f が範囲 ${SWING_PERIOD_MIN}〜${SWING_PERIOD_MAX} の外です (x=${o.x})`,
        })
      }
    }
    // OB-14 spear（GDD §15-5）
    if (o.t === 'spear') {
      // GATE の下段になっている槍は、窓が隙間 B で決まるので単体の解析窓は当てない
      if (gateLowers.has(o.x)) continue
      /*
       * 型上限 54 は「回避不能になる線」（速度に依存しない・社長指示の違反を防ぐ）。
       * **境界の内側を示す線ではなく、境界の外側に打った杭である。**
       */
      if (o.h < SPEAR_H_MIN || o.h > SPEAR_H_MAX) {
        issues.push({
          level: 'FAIL',
          code: 'SPEAR_H',
          message: `槍の高さ ${o.h}px が型上限の範囲 ${SPEAR_H_MIN}〜${SPEAR_H_MAX} の外です (x=${o.x})。${SPEAR_H_MAX}px 超は回避不能になる`,
        })
      } else if (o.h > SPEAR_H_PRACTICAL_MAX) {
        /*
         * 設計上限 52 は「生存窓が帯に収まる線」で、**速度の関数**である。
         * 生存窓検査は1本書き終えた後にしか鳴らないので、
         * **データを書いた時点で速度別の解析窓を添えて早期に警告する**。
         */
        const w = spearSurvivalWindow(o.h, stage.speedPxPerFrame)
        const floor = budget.windowMinFrames
        if (w < floor) {
          issues.push({
            level: 'FAIL',
            code: 'SPEAR_H_WINDOW',
            message: `槍 h=${o.h} は速度 ${stage.speedPxPerFrame} での解析生存窓が ${w.toFixed(2)}f となり、下限 ${floor}f を割ります (x=${o.x})。設計上限は ${SPEAR_H_PRACTICAL_MAX}px`,
          })
        } else {
          issues.push({
            level: 'WARN',
            code: 'SPEAR_H_HIGH',
            message: `槍 h=${o.h} は既定の設計上限 ${SPEAR_H_PRACTICAL_MAX}px を超えます (x=${o.x})。速度 ${stage.speedPxPerFrame} での解析生存窓 ${w.toFixed(2)}f（下限 ${floor}f）。この速度での実測を添えること`,
          })
        }
      }
      if (o.rise < SPEAR_RISE_MIN || o.rise > SPEAR_RISE_MAX) {
        issues.push({
          level: 'FAIL',
          code: 'SPEAR_RISE',
          message: `槍の伸長 ${o.rise}f が範囲 ${SPEAR_RISE_MIN}〜${SPEAR_RISE_MAX} の外です (x=${o.x})`,
        })
      }
      // 静止モード（triggerX < 0）はトラップではないのでトリガー規定の対象外（§15-14 #5）
      if (o.triggerX < 0) continue
      // S1: 通過開始までに伸びきっていること / S2: 跳ぶ判断を終えた後に生え始めること
      const v = stage.speedPxPerFrame
      const sx = o.x + 1 // 判定左端（視覚6px の中央に判定4px）
      const lo = sx - 69 - JUMP_APEX_FRAMES * v
      const hi = sx - 69 - o.rise * v
      if (o.triggerX < lo || o.triggerX > hi) {
        issues.push({
          level: 'FAIL',
          code: 'SPEAR_TRIGGER',
          message: `槍の triggerX=${o.triggerX} が許容帯 ${lo.toFixed(1)}〜${hi.toFixed(1)} の外です (x=${o.x})。S1(通過までに伸びきる)/S2(跳ぶ判断の後に生える) を満たさない`,
        })
      }
    }
    // OB-15 drop（G5・GDD §16-6）
    if (o.t === 'drop') {
      if (o.y < 16 || o.y + DROP_H > stage.groundY) {
        issues.push({
          level: 'FAIL',
          code: 'DROP_Y',
          message: `drop の y=${o.y} が画面内に収まりません (x=${o.x})。16 〜 ${stage.groundY - DROP_H} の範囲`,
        })
      }
      if (o.falls && o.triggerX < 0) {
        issues.push({
          level: 'FAIL',
          code: 'DROP_TRIGGER',
          message: `落ちる drop (falls=true) に triggerX がありません (x=${o.x})。トリガーは cameraX のみを参照する`,
        })
      }
      if (!o.falls && o.triggerX >= 0) {
        issues.push({
          level: 'WARN',
          code: 'DROP_TRIGGER',
          message: `落ちない drop (falls=false) に triggerX が設定されています (x=${o.x})。無視されるので -1 にすること`,
        })
      }
      // 落下は自分の真下だけを塞ぐ。落ちる先が谷だと「落ちたのに通れる」ことになり、
      // 上下どちらを通るかの選択（G5 の本体）が成立しない
      if (o.falls) {
        const overPit = stage.objects.some(
          (q) => q.t === 'pit' && q.x < o.x + DROP_W && o.x < q.x + q.w,
        )
        if (overPit) {
          issues.push({
            level: 'FAIL',
            code: 'DROP_OVER_PIT',
            message: `落ちる drop が谷の上にあります (x=${o.x})。落下しても地上が塞がらず、上下の選択が成立しない`,
          })
        }
      }
      // 落ちないのに揺れる個体は**禁止**。1つ置けば予兆が信用されなくなり、
      // 前半の学習がその1個で無効になる（企画 駆の裁定）
      if (!o.falls && o.tell === true) {
        issues.push({
          level: 'FAIL',
          code: 'DROP_FAKE_TELL',
          message: `落ちない drop に予兆 tell=true が付いています (x=${o.x})。揺れて落ちない個体を1つ置けば予兆が信用されなくなり、それまでの学習が無効になる`,
        })
      }
      // crumble（踏んでから落ちる）と drop（踏まなくても落ちる）を近くに置かない（§16-6）
      const near = stage.objects.find(
        (q) => q.t === 'crumble' && Math.abs(q.x - o.x) < DROP_CRUMBLE_MIN_SEPARATION,
      )
      if (near) {
        issues.push({
          level: 'FAIL',
          code: 'DROP_CRUMBLE_MIX',
          message: `drop (x=${o.x}) と crumble (x=${(near as { x: number }).x}) が ${DROP_CRUMBLE_MIN_SEPARATION}px 以内にあります。「踏んで落ちる／踏まなくても落ちる」が混同される`,
        })
      }
    }
    // OB-08 fly の速度域と先読み猶予（GDD §15-4 F1/F2）
    if (o.t === 'fly') {
      // G6 上下動（§16-6）。amp=0 で後方互換なので、amp>0 のときだけ範囲を見る
      const amp = o.amp ?? 0
      if (amp !== 0 && (amp < FLY_AMP_MIN || amp > FLY_AMP_MAX)) {
        issues.push({
          level: 'FAIL',
          code: 'FLY_AMP',
          message: `飛行体の amp=${amp} が範囲 ${FLY_AMP_MIN}〜${FLY_AMP_MAX} の外です (x=${o.x})`,
        })
      }
      if (amp > 0) {
        const period = o.period ?? 0
        if (period < FLY_PERIOD_MIN || period > FLY_PERIOD_MAX) {
          issues.push({
            level: 'FAIL',
            code: 'FLY_PERIOD',
            message: `上下動する飛行体の period=${period} が範囲 ${FLY_PERIOD_MIN}〜${FLY_PERIOD_MAX} の外です (x=${o.x})`,
          })
        }
        if (FLY_ALT_Y[o.alt] - amp < 16) {
          issues.push({
            level: 'FAIL',
            code: 'FLY_AMP',
            message: `上下動する飛行体が画面上端を突き抜けます (x=${o.x})。alt=${o.alt} (y=${FLY_ALT_Y[o.alt]}) に amp=${amp} は過大`,
          })
        }
      }
      if (o.vx < FLY_VX_MIN || o.vx > FLY_VX_MAX) {
        issues.push({
          level: 'FAIL',
          code: 'FLY_VX',
          message: `飛行体の vx=${o.vx} が範囲 ${FLY_VX_MIN}〜${FLY_VX_MAX} の外です (x=${o.x})`,
        })
      }
      const lookahead = LOOKAHEAD_PX / (stage.speedPxPerFrame + o.vx)
      if (lookahead < FLY_LOOKAHEAD_MIN_FRAMES) {
        issues.push({
          level: 'FAIL',
          code: 'FLY_LOOKAHEAD',
          message: `飛行体の先読み猶予 ${lookahead.toFixed(1)}f が下限 ${FLY_LOOKAHEAD_MIN_FRAMES}f を下回ります (x=${o.x})。視覚による確認が原理的に成立しない`,
        })
      } else if (lookahead < FLY_LOOKAHEAD_WARN_FRAMES) {
        const hasWarn = stage.objects.some((w) => w.t === 'warn' && w.x < o.x && o.x - w.x < 400)
        issues.push({
          level: hasWarn ? 'WARN' : 'FAIL',
          code: 'FLY_SURPRISE',
          message: `飛行体の先読み猶予 ${lookahead.toFixed(1)}f が ${FLY_LOOKAHEAD_WARN_FRAMES}f 未満（初見殺し扱い・x=${o.x}）。${hasWarn ? 'warn マーカーあり' : '§7-3 ルールB の warn マーカーが必要'}`,
        })
      }
    }
    if (o.t === 'ceil' && (o.y < 12 || o.y + 16 > stage.groundY)) {
      issues.push({
        level: 'FAIL',
        code: 'CEIL_Y',
        message: `天井が HUD 帯／地面に食い込んでいます (x=${o.x}, y=${o.y})`,
      })
    }
  }

  const gapMax = Math.floor(reach * GAP_MAX_RATIO)
  const islands = landableIntervals(stage)
  for (let i = 1; i < islands.length; i++) {
    const gap = islands[i].x - islands[i - 1].end
    if (gap > gapMax) {
      issues.push({
        level: 'FAIL',
        code: 'GAP',
        message: `着地点の間隔 ${gap}px が上限 ${gapMax}px（水平到達 ${reach} x 0.92）を超えます (x=${islands[i - 1].end})`,
      })
    }
  }

  // GATE の溶接条件（GDD §16-10【P0】）
  for (const [ci, oi] of pairs) {
    const c = stage.objects[ci] as { x: number; w: number }
    const lo = stage.objects[oi]
    const lw = lo.t === 'block' ? lo.w : lo.t === 'pit' ? lo.w : SPEAR_VIS_W
    // **右端は一致（=）でなければならない**（彩色 映 R19）。
    // 超えれば「下段を突破した後に ceil で死ぬ経路」が生まれて誤帰属1になり溶接が外れる。
    // 足りなければ「くぐった後にまだ障害物がある」に見え、門が単一の関門として読めない。
    if (c.x + c.w !== lo.x + lw) {
      issues.push({
        level: 'FAIL',
        code: 'GATE_WELD',
        message: `GATE の右端が揃っていません (ceil 右端 ${c.x + c.w} / 下段 ${lo.t} 右端 ${lo.x + lw})。出口が1本の垂直線にならないと門が単一の関門として読めない`,
      })
    }
    // B は**見た目の隙間ではなく、致死ボックスが収まるべき垂直クリアランス**。
    // 画面上の開口 = 致死ボックス 13px + B（彩色 映 R19 の訂正）。
    const b = gateGap(stage, ci, oi)
    if (b < GATE_B_WARN) {
      issues.push({
        level: b < GATE_B_MIN ? 'FAIL' : 'WARN',
        code: 'GATE_B',
        message:
          `GATE の垂直クリアランス B=${b}px（画面上の開口 ${b + PLAYER_HITBOX_H}px）が実用下限 ${GATE_B_WARN}px を下回ります (x=${c.x})。` +
          `判定外のアンテナ(上2px)とつま先(下1px)の計3px が毎回めり込み、「当たっているのに死なない」に見えて判定への信頼を削る`,
      })
    }
  }

  issues.push(...wallChecks(stage))
  issues.push(...catalogLimits(stage))

  // 検査: 障害物 総数の**上限**（GDD §15-16）。設計値（単一値）は撤回された。
  // 誤帰属0を満たす最小間隔クラス 1.12R から 60/(1.12x41.67)=1.286 個/秒。
  // R に速度が含まれるので**速度に依存しない**。下限は持たない。
  const counted = stage.objects.filter((o) => o.t !== 'warn').length
  const stageSeconds = stage.lengthPx / (stage.speedPxPerFrame * 60)
  const maxCount = Math.floor(stageSeconds * MAX_OBJECTS_PER_SECOND)
  if (counted > maxCount) {
    issues.push({
      level: 'FAIL',
      code: 'COUNT',
      message: `障害物 総数 ${counted} が上限 ${maxCount}（長さ ${stageSeconds.toFixed(1)}s x ${MAX_OBJECTS_PER_SECOND.toFixed(2)} 個/秒）を超えます。誤帰属0の最小間隔では物理的に置けない本数`,
    })
  }

  return issues
}

// ---------------------------------------------------------------------------
// 総合検査（GDD §7-4 の検査9項目）
// ---------------------------------------------------------------------------

export function verifyStage(stage: StageDef, budget: StageBudget): VerifyResult {
  const issues = staticChecks(stage, budget)
  const solve = solveStage(stage, budget.windowMinFrames)

  // 検査1: 突破可能性
  if (!solve.feasible) {
    issues.push({
      level: 'FAIL',
      code: 'UNSOLVABLE',
      message: 'ゴールに到達する入力列が1本も存在しません',
    })
    return { stageId: stage.id, stageName: stage.name, solve, issues, ok: false }
  }

  // 検査2: 生存窓 下限（推奨ルート ＝ マキシミン経路）
  if (solve.minWindow < budget.windowMinFrames) {
    issues.push({
      level: 'FAIL',
      code: 'WINDOW_MIN',
      message: `推奨ルートの最小生存窓 ${solve.minWindow}f が §6-3 の下限 ${budget.windowMinFrames}f を下回ります（到達率 ${(solve.minWindowAt * 100).toFixed(1)}%）`,
    })
  }

  // 検査3: 生存窓 上限（緩すぎの検出。S1 は除外）
  if (stage.id !== 1 && solve.minWindow > budget.windowMaxFrames) {
    issues.push({
      level: 'FAIL',
      code: 'WINDOW_MAX',
      message: `推奨ルートの最小生存窓 ${solve.minWindow}f が §6-3 の上限 ${budget.windowMaxFrames}f を超えます（緩すぎ）`,
    })
  }

  // 検査4: 最悪生存窓（警告）。3f **以下** で警告（§14-10 で「未満」から改定）。
  // 警告時は §7-3 ルールB の予告マーカー設置を義務とする
  if (solve.worstWindow <= WORST_WINDOW_WARN) {
    const hasWarn = stage.objects.some((o) => o.t === 'warn')
    issues.push({
      level: 'WARN',
      code: 'WORST_WINDOW',
      message: `最悪生存窓 ${solve.worstWindow}f がしきい値 ${WORST_WINDOW_WARN}f 以下です（到達率 ${(solve.worstWindowAt * 100).toFixed(1)}%）`,
    })
    if (!hasWarn) {
      issues.push({
        level: 'FAIL',
        code: 'WARN_MARKER',
        message: '最悪生存窓の警告が出ているのに §7-3 ルールB の warn マーカーがありません',
      })
    }
  }

  // 検査5: 誤帰属距離（GDD §14-8。旧「詰み潜伏時間 42f 上限」の置換）
  if (solve.maxMisattribGap > MISATTRIB_GAP_MAX) {
    const head = solve.misattribHits
      .map(
        (d) =>
          `${d.misattrib}地点 (f${d.frame}→f${d.deathFrame})@${(d.at * 100).toFixed(1)}%`,
      )
      .join(' / ')
    issues.push({
      level: 'FAIL',
      code: 'MISATTRIB',
      message: `誤帰属距離 ${solve.maxMisattribGap} が上限 ${MISATTRIB_GAP_MAX} を超えます（詰みと死亡の間に成功体験が挟まる＝遅延死）: ${head}`,
    })
  }

  // 検査5b: 可制御詰み潜伏時間（警告）。詰んでいるのに操作させ続けている時間（§9-5 の摩擦）
  if (solve.maxDeadEndCtrl > DEADEND_CTRL_WARN) {
    const head = solve.ctrlHits
      .map((d) => `${d.ctrl}f@${(d.at * 100).toFixed(1)}%`)
      .join(' / ')
    issues.push({
      level: 'WARN',
      code: 'DEADEND_CTRL',
      message: `可制御詰み潜伏時間 ${solve.maxDeadEndCtrl}f がしきい値 ${DEADEND_CTRL_WARN}f を超えます（詰んでいるのに操作させ続けている）: ${head}`,
    })
  }

  // 検査7: チェイン長・息継ぎ
  const chapter = Math.min(CHAPTER_MAX_SECONDS.length - 1, Math.floor((stage.id - 1) / 5))
  const chainLimit = Math.min(CHAIN_MAX_GLOBAL, budget.maxChain)
  if (solve.maxChain > chainLimit) {
    issues.push({
      level: 'FAIL',
      code: 'CHAIN',
      message: `最大チェイン長 ${solve.maxChain} が §6-3 の上限 ${chainLimit} を超えます`,
    })
  }
  if (solve.breathViolations.length > 0) {
    issues.push({
      level: 'FAIL',
      code: 'BREATH',
      message: `息継ぎ規定違反（連鎖長4以上の直後に接地 ${BREATH_MIN}f 未満）: ${solve.breathViolations
        .map((a) => `${(a * 100).toFixed(1)}%`)
        .join(' / ')}`,
    })
  }

  // 検査10〜12: 新指標の帯（GDD §15-7-3 / §15-7-4）
  const band = (
    v: number,
    [lo, hi]: readonly [number, number],
    code: string,
    label: string,
    level: IssueLevel,
  ) => {
    if (v < lo || v > hi) {
      issues.push({
        level,
        code,
        message: `${label} ${v.toFixed(3)} が帯 ${lo}〜${hi} の外です`,
      })
    }
  }
  // 狭窓密度は **章の表の下限のみ**（§16-2 / §16-10 #4 で上限は撤廃）
  const tdMin = CHAPTER_TIGHT_DENSITY_MIN[chapter]
  if (solve.tightDensity < tdMin) {
    issues.push({
      level: 'FAIL',
      code: 'TIGHT_DENSITY',
      message: `狭窓密度 ${solve.tightDensity.toFixed(3)} が章${chapter + 1}の下限 ${tdMin} を下回ります（上限は §16-10 で撤廃）`,
    })
  }
  band(solve.suppressRatio, budget.suppressRatio, 'SUPPRESS_RATIO', '抑制率', 'FAIL')
  band(solve.compositeRatio, budget.compositeRatio, 'COMPOSITE_RATIO', '複合度', 'WARN')

  // 検査9: クライマックス位置（区間難度 D(t)）。S1 のみ警告
  if (solve.climaxAt < CLIMAX_MIN_RATIO || solve.climaxAt > CLIMAX_MAX_RATIO) {
    const pits = pitsInClimax(stage)
    issues.push({
      level: budget.climaxWarnOnly ? 'WARN' : 'FAIL',
      code: 'CLIMAX',
      message:
        `区間難度 D(t) のピークが到達率 ${(solve.climaxAt * 100).toFixed(1)}%（D=${solve.climaxD.toFixed(2)}）で、85〜95% の外にあります` +
        (pits.length > 0
          ? `。原因の候補: クライマックス帯に谷があります (x=${pits.join(', ')})。谷は後続の安全間隔を広げるため D(t) のピークが前へずれる`
          : ''),
    })
  }

  // 検査13: ステージ長の上限（章ごと・GDD §15-15）
  const maxSecs = stage.id === 30 ? FINAL_STAGE_MAX_SECONDS : CHAPTER_MAX_SECONDS[chapter]
  if (solve.seconds > maxSecs) {
    issues.push({
      level: 'FAIL',
      code: 'LENGTH',
      message: `ステージ長 ${solve.seconds.toFixed(1)}s が章${chapter + 1}の上限 ${maxSecs}s を超えます。長さは従属変数ではなく制約（§8-3 のチェックポイント不採用は長さ上限とセットでしか成立しない）`,
    })
  }

  // 検査14: 平均要求タップ/秒 — **章ごとの帯**（GDD §15-16）
  //
  // 旧「§6-3 の単一設計値 x 比率」は撤回された。S8 0.90 / S9 1.00 / S10 1.10 は
  // 実効上限を超えており、いかなる配置でも到達できない値だったため。
  // 実効上限 = 理論最大 x (1 - 抑制率上限)。抑制オブジェクトは時間を消費して
  // タップを生まないので、**章が進むほど密度の上限は下がる**。
  //
  // 下限は S1 を除外する。S1 は導入で、連鎖上限 1・生存窓 36f の意図的に薄い設計。
  // 検査3（生存窓 上限＝緩すぎの検出）と検査9（クライマックス）で既に S1 を
  // 除外しているのと同じ理由で、**「緩すぎ」側の検出器は S1 に当てない**。
  // 実測 0.40（章I の帯は 0.55〜0.80）。上限側は S1 にも当てる。
  const [tpsLo, tpsHi] = CHAPTER_TAPS_PER_SEC_BAND[chapter]
  const effCeiling = effectiveTapsPerSecondCeiling(chapter)
  if (solve.tapsPerSecond > tpsHi) {
    issues.push({
      level: 'FAIL',
      code: 'TAPS_PER_SEC',
      message: `平均要求タップ/秒 ${solve.tapsPerSecond.toFixed(2)} が章${chapter + 1}の帯 ${tpsLo}〜${tpsHi} の上を超えます（実効上限 ${effCeiling.toFixed(2)}）`,
    })
  } else if (stage.id !== 1 && solve.tapsPerSecond < tpsLo) {
    issues.push({
      level: 'FAIL',
      code: 'TAPS_PER_SEC',
      message:
        `平均要求タップ/秒 ${solve.tapsPerSecond.toFixed(2)} が章${chapter + 1}の帯 ${tpsLo}〜${tpsHi} の下を割ります（実効上限 ${effCeiling.toFixed(2)}）。` +
        `「たまに難所がある、間延びしたステージ」になっている`,
    })
  }

  // 検査16: 狭窓の出所の多様性（GDD §16-10 #3）
  // 難易度の出所が1種類に偏ることを**構造として禁じる**。
  // 記憶に残るステージ像が「壁、壁、壁」になってはならない。
  // S1 は除外する。「初出は2要素まで」（§16-10）の下で S1 が使える新要素は
  // `block` と `spear` の2つだけで、**`block` は狭窓を作れない**（単体で最小13f）。
  // つまり S1 の狭窓の出所は原理的に1種類しか存在しない。
  // 検査3（生存窓 上限）と検査9（クライマックス）で既に S1 を除外しているのと同じ形。
  const kinds = tightUnitKinds(stage, solve.route, tightWindowThreshold(budget.windowMinFrames))
  const tightTotal = [...kinds.values()].reduce((a, b) => a + b, 0)
  if (tightTotal >= 4 && stage.id !== 1) {
    for (const [k, n] of kinds) {
      if (n / tightTotal > TIGHT_UNIT_SHARE_MAX) {
        issues.push({
          level: 'FAIL',
          code: 'TIGHT_UNIT_SHARE',
          message: `狭窓 ${tightTotal} 本のうち ${k} が ${n} 本（${((n / tightTotal) * 100).toFixed(0)}%）で上限 ${TIGHT_UNIT_SHARE_MAX * 100}% を超えます。難易度の出所が1種類に偏っている`,
        })
      }
    }
  }

  // 検査15b: 知識由来の死 D_knowledge（企画 駆の裁定・2026-09-22）
  //
  // `E[D] = E[D_skill] + D_knowledge` に分解する。`D_knowledge` は**初見でのみ**発生し、
  // 繰り返し挑戦の難易度を一切作らない。ここに頼ると覚えた瞬間に急に簡単になり、
  // フローが崩れる。**上限は目標死亡回数の1割**＝「いじわるは味付けであって主菜ではない」。
  // 内訳が分かれること自体に価値がある —— **どちらが足りないのかが分かる**。
  const dKnowledge = knowledgeDeaths(stage)
  const dkMax = budget.deathTarget * KNOWLEDGE_DEATH_RATIO
  if (dKnowledge > dkMax) {
    issues.push({
      level: 'FAIL',
      code: 'KNOWLEDGE_DEATHS',
      message: `知識由来の死 D_knowledge=${dKnowledge} が上限 ${dkMax.toFixed(1)}（目標 ${budget.deathTarget} の1割）を超えます。初見でしか効かない死に頼ると、覚えた瞬間に急に簡単になる`,
    })
  }
  // 予兆なし drop があるステージは、区間層の予告（warn）を省略できない。
  // warn を外すと「そのステージに drop があること自体」が隠れ、
  // 「何周しても観測不能」＝理不尽の側に落ちる
  if (dKnowledge > 0 && !stage.objects.some((o) => o.t === 'warn')) {
    issues.push({
      level: 'FAIL',
      code: 'NO_TELL_NEEDS_WARN',
      message: `予兆なし drop があるのに予告マーカー（warn）がありません。個体層（揺れ）は外せても区間層（warn）は外せない`,
    })
  }

  // 検査15: 期待死亡回数 E[D_skill]（GDD §16-7）**本章の最重要成果物**
  //
  // これだけが σ という**人間側の実測量**に接続されている。生存窓・誤帰属距離・D(t)・
  // 狭窓密度は全て企画の想定から導かれていて、指標体系が自己参照になっていた。
  // 旧10本は全ての検査に合格していながら E[D] 合計が約 0.5 回で、社長は無死亡で通した。
  const edLo = budget.deathTarget * DEATH_TARGET_LO
  const edHi = budget.deathTarget * DEATH_TARGET_HI
  const sens = solve.expectedDeathsBySigma
    .map((e) => `σ=${e.sigma}: ${e.value.toFixed(1)}`)
    .join(' / ')
  if (solve.expectedDeaths < edLo) {
    issues.push({
      level: 'FAIL',
      code: 'EXPECTED_DEATHS',
      message: `期待死亡回数 E[D_skill]=${solve.expectedDeaths.toFixed(1)} が目標 ${budget.deathTarget} の帯 ${edLo.toFixed(1)}〜${edHi.toFixed(1)} を下回ります（死にゲーになっていない）。[${sens}]`,
    })
  } else if (solve.expectedDeaths > edHi) {
    issues.push({
      level: 'FAIL',
      code: 'EXPECTED_DEATHS',
      message: `期待死亡回数 E[D_skill]=${solve.expectedDeaths.toFixed(1)} が目標 ${budget.deathTarget} の帯 ${edLo.toFixed(1)}〜${edHi.toFixed(1)} を上回ります（理不尽）。[${sens}]`,
    })
  }

  return {
    stageId: stage.id,
    stageName: stage.name,
    solve,
    issues,
    ok: issues.every((i) => i.level !== 'FAIL'),
  }
}

/**
 * 決定論の回帰テスト（GDD §12-6）。
 * 同一の入力フレーム列を2回再生し、最終状態が完全に一致することを確かめる。
 */
export function checkDeterminism(stage: StageDef, tapFrames: number[]): boolean {
  const taps = new Set(tapFrames)
  const run = () => {
    const sim = createSim(stage)
    const limit = goalFrame(stage) + 8
    while (!sim.dead && !sim.cleared && sim.stageFrame <= limit) {
      stepSim(stage, sim, taps.has(sim.stageFrame))
    }
    return [
      sim.stageFrame,
      sim.player.y,
      sim.player.vy,
      sim.player.state,
      sim.dead ? 1 : 0,
      sim.cleared ? 1 : 0,
      sim.deathObjIndex,
      playerWorldX(stage, sim.stageFrame),
    ].join('|')
  }
  return run() === run()
}
