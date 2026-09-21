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
  CHAIN_MAX_GLOBAL,
  CLIMAX_MAX_RATIO,
  CLIMAX_MIN_RATIO,
  CLIMAX_NORM_FRAMES,
  CLIMAX_WINDOW_FRAMES,
  COYOTE_TIME,
  CRUMBLE_W,
  FLY_W,
  DEADEND_CTRL_WARN,
  MISATTRIB_GAP_MAX,
  GAP_MAX_RATIO,
  LIFT_W,
  OBSTACLE_MAX_H,
  PIT_MAX_RATIO,
  PIT_MIN_W,
  PLAT_W,
  PLAYER_HITBOX_OX,
  PLAYER_X,
  SPIKE_UNIT,
  SPRING_W,
  WORST_WINDOW_WARN,
} from './constants'
import { canJumpNow } from './input'
import { horizontalReach, lethalTop } from './physics'
import {
  cloneSim,
  createSim,
  goalFrame,
  playerWorldX,
  progressRatio,
  stepSim,
} from './stageRuntime'
import type { SimState, StageBudget, StageDef } from './types'

const INF = Number.POSITIVE_INFINITY

/** 状態数の安全弁。これを超えたら設計が破綻しているので探索を打ち切る */
const MAX_STATES = 4_000_000

const ZERO_PROFILE = { frames: 0, ctrl: 0 }

// ---------------------------------------------------------------------------
// 結果の型
// ---------------------------------------------------------------------------

/** 推奨ルート（マキシミン経路）上の 1 ジャンプ */
export type RouteJump = {
  /** 何本目のジャンプか（1始まり） */
  index: number
  /** タップするフレーム（この窓の中で最も安全な位置） */
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
  /**
   * このタップが対象とする障害物を通過し終えるフレーム（＝プレイヤーが
   * 「クリアした」と知覚するイベントの発生時刻）。誤帰属距離の計測に使う
   */
  passFrame: number
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
  if (sim.crumbleTrigger.length > 0) k += '|' + sim.crumbleTrigger.join(',')
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

  /** 状態 s からゴールまでの最小タップ数。Infinity なら勝利領域 W の外 */
  minTaps(sim: SimState): number {
    if (sim.cleared) return 0
    if (sim.dead) return INF
    if (sim.stageFrame > this.maxFrame) return INF

    const key = stateKey(sim)
    const hit = this.memoTaps.get(key)
    if (hit !== undefined) return hit
    if (this.memoTaps.size > MAX_STATES) {
      throw new Error(
        `solver: 状態数が上限 ${MAX_STATES} を超えました（stage ${this.stage.id}）`,
      )
    }
    this.memoTaps.set(key, INF)

    let best = this.minTaps(this.advance(sim, false))
    if (canJumpNow(sim.stageFrame, sim.player)) {
      const t = this.minTaps(this.advance(sim, true))
      if (t !== INF && t + 1 < best) best = t + 1
    }

    this.memoTaps.set(key, best)
    return best
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
   * 到達状態 s の生存窓を測る（GDD §14-①）。
   *
   * s から跳ばずに進め、ジャンプ可能なフレームを列挙し、
   * 「タップすると最小タップ数がちょうど1減る」フレームを **有効タップ** として
   * 抽出したうえで、その **連続フレーム列** を切り出す。
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

    const runs: { from: number; to: number }[] = []
    let start = -1
    for (let i = 0; i < run.length; i++) {
      // 有効タップのフィルタ（§14-9 で承認済み。合算ではなく絞り込み）
      //
      // TODO【P1 / GDD §14-12 #5・S5 のステージ作成に着手する前に実施】
      //   この厳格な等式は「追加タップを払って上面に乗る迂回ルート」を窓計算から
      //   除外してしまう。影響は保守側（窓が狭く出る）なので S1〜S3 の結果は有効だが、
      //   S5（OB-05 浮遊足場）以降「上に乗るのが正解」の配置では偽陽性が出る。
      //   拡張案: ok = s' in W かつ ( T(s') <= T(s)-1
      //                             または s' が「跳ばずに走り続ける」では到達できない状態 )
      const ok =
        target !== INF &&
        target > 0 &&
        this.minTaps(this.advance(run[i], true)) + 1 === target
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
      passFrame: -1,
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

/**
 * 各「要求タップ地点」の通過フレームを求める（GDD §14-8-3）。
 *
 * 推奨ルートのタップ i について、そのタップが対象とする障害物
 * （タップ時点でプレイヤーの前方にある最初の非 warn 障害物）の右端を
 * プレイヤーの致死ボックス左辺が追い越すフレームを返す。
 * これが「プレイヤーが『クリアした』と知覚するイベント」の発生時刻の候補になる。
 *
 * ただし **フレームだけでは成功体験と断定できない**。谷（OB-03）に落ちた場合、
 * ワールドXは谷の右端を通り過ぎるが、プレイヤーは穴の中にいて「越えた」とは
 * 知覚しない。そのため実際の計数時に「地面より上にいたか」を併せて判定する
 * （countPassedOnPath）。
 */
function computePassFrames(stage: StageDef, route: RouteJump[]): number[] {
  const edges = stage.objects
    .filter((o) => o.t !== 'warn')
    .map((o) => {
      const w =
        o.t === 'block' ? o.w
          : o.t === 'pit' ? o.w
          : o.t === 'spike' ? o.n * SPIKE_UNIT
          : o.t === 'ceil' ? o.w
          : o.t === 'plat' ? PLAT_W
          : o.t === 'lift' ? LIFT_W
          : o.t === 'crumble' ? CRUMBLE_W
          : o.t === 'fly' ? FLY_W
          : SPRING_W
      return o.x + w
    })
    .sort((a, b) => a - b)

  const out: number[] = []
  for (const j of route) {
    const lethalLeft = playerWorldX(stage, j.frame) + PLAYER_HITBOX_OX
    const right = edges.find((e) => e > lethalLeft)
    if (right === undefined) {
      out.push(Number.POSITIVE_INFINITY)
      continue
    }
    const f = Math.ceil((right - PLAYER_HITBOX_OX - PLAYER_X) / stage.speedPxPerFrame) + 1
    out.push(f)
  }
  return out
}

/**
 * 誤帰属距離を数える（GDD §14-8-3）。
 *
 * 詰み状態 `doom` から最長生存の継続をたどり、その途中で
 * **要求タップ地点を「地面より上にいる状態で」通過した回数**を返す。
 * 谷に落ちながらXだけ通り過ぎた場合は成功体験ではないので数えない。
 */
function countPassedOnPath(
  search: Search,
  stage: StageDef,
  doom: SimState,
  deathFrame: number,
  passFrames: number[],
): number {
  // 候補が無ければ歩かずに 0
  const candidates = passFrames.filter((f) => f > doom.stageFrame && f <= deathFrame)
  if (candidates.length === 0) return 0
  const wanted = new Set(candidates)

  let n = 0
  let s = doom
  while (!s.dead && !s.cleared && s.stageFrame <= search.maxFrame) {
    if (wanted.has(s.stageFrame)) {
      // 致死ボックス上辺が地面より上（＝穴に落ちている最中ではない）なら成功体験
      if (lethalTop(s.player.y) <= stage.groundY) n++
    }
    // 最長生存の分岐をたどる
    const noJump = search.advance(s, false)
    let pick = noJump
    if (canJumpNow(s.stageFrame, s.player)) {
      const jump = search.advance(s, true)
      const a = search.survivalProfile(noJump)
      const b = search.survivalProfile(jump)
      if (b.frames > a.frames || (b.frames === a.frames && b.ctrl > a.ctrl)) pick = jump
    }
    s = pick
  }
  return n
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
  passFrames: number[],
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
          const misattrib = countPassedOnPath(search, stage, n, deathFrame, passFrames)
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

export function solveStage(stage: StageDef): SolveResult {
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

  // 要求タップ地点の通過フレーム（誤帰属距離の計測に使う）
  const passFrames = computePassFrames(stage, mm.route)
  for (let i = 0; i < mm.route.length; i++) mm.route[i].passFrame = passFrames[i]

  const scan = scanReachable(search, stage, passFrames)
  const climax = climaxOf(stage, mm.route, goalFrame(stage))

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
    climaxD: climax.d,
    climaxAt: climax.at,
    statesExplored: search.states,
    arrivalsAnalyzed: search.arrivals,
  }
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

export function staticChecks(stage: StageDef, budget: StageBudget): CheckIssue[] {
  const issues: CheckIssue[] = []
  const reach = horizontalReach(stage.speedPxPerFrame)

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
    if (o.t === 'block' && o.h > OBSTACLE_MAX_H) {
      issues.push({
        level: 'FAIL',
        code: 'OBJ_H',
        message: `障害物の高さ ${o.h}px が上限 ${OBSTACLE_MAX_H}px を超えます (x=${o.x})`,
      })
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

  const counted = stage.objects.filter((o) => o.t !== 'warn').length
  if (counted !== budget.objectCount) {
    issues.push({
      level: 'WARN',
      code: 'COUNT',
      message: `障害物 総数 ${counted} が GDD §6-3 の設計値 ${budget.objectCount} と異なります`,
    })
  }

  return issues
}

// ---------------------------------------------------------------------------
// 総合検査（GDD §7-4 の検査9項目）
// ---------------------------------------------------------------------------

export function verifyStage(stage: StageDef, budget: StageBudget): VerifyResult {
  const issues = staticChecks(stage, budget)
  const solve = solveStage(stage)

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

  // 検査9: クライマックス位置（区間難度 D(t)）。S1 のみ警告
  if (solve.climaxAt < CLIMAX_MIN_RATIO || solve.climaxAt > CLIMAX_MAX_RATIO) {
    issues.push({
      level: budget.climaxWarnOnly ? 'WARN' : 'FAIL',
      code: 'CLIMAX',
      message: `区間難度 D(t) のピークが到達率 ${(solve.climaxAt * 100).toFixed(1)}%（D=${solve.climaxD.toFixed(2)}）で、85〜95% の外にあります`,
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
