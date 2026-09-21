/**
 * JumpOrDie — ステージソルバ（自動検証ツール）【P1】
 *
 * 出典: GDD §7-4（ステージソルバ）/ §5-3（配置上限）/ §6-3（最小タップ窓）
 *
 * > すべてのステージは、機械的に「突破可能である」ことを証明してから出荷すること。
 *
 * ジャンプ弧が定数（GDD §2-4 でホールド変調を捨てた）ため、探索空間は
 * 「各フレームで跳ぶ／跳ばない」の2択のみ。接地中のフレームでしか分岐しない。
 * stageFrame は必ず増加するので状態遷移グラフは DAG であり、メモ化再帰で全探索できる。
 *
 * 【探索の定義】
 *   T(s) = 状態 s からゴールまでに必要な **最小タップ数**（到達不能なら Infinity）
 * 最小タップ数を基準にすることで「早く跳びすぎて手前に着地し、もう一度跳ぶ」
 * という余計な1タップを使う経路が窓の計測に混入しない。
 *
 * 【タップ窓の定義】
 * GDD §7-4 検査2 は「突破解のうち **最も余裕のある経路** でも下限を下回るジャンプが
 * 存在しないこと」を求めている。したがって窓は経路1本ではなく、
 * **最小タップ解すべての和集合** で測る。
 *
 *   W_i = { f | i 番目のタップを frame f に置く最小タップ解が存在する }
 *
 * これは前方探索で「最適経路上にある状態」だけを展開すれば厳密に求まる。
 * W_i の連続区間長がそのタップの許容窓（フレーム）である。
 *
 * 参考値として、最小タップ数を保ったまま **最も遅く跳ぶ** 経路（canonical path）の
 * 窓も併せて出す（strictWindows）。こちらは「ギリギリの経路を選んでしまった場合」の
 * 下限であり、チェイン長の計測にも使う（最も遅い ＝ 最も詰まった連鎖になるため）。
 */

import {
  CHAIN_GROUNDED_FRAMES,
  CHAIN_MAX,
  CLIMAX_MAX_RATIO,
  CLIMAX_MIN_RATIO,
  COYOTE_TIME,
  GAP_MAX_RATIO,
  OBSTACLE_MAX_H,
  PIT_MAX_RATIO,
  PIT_MIN_W,
  PLAT_W,
  CRUMBLE_W,
  LIFT_W,
} from './constants'
import { canJumpNow } from './input'
import { horizontalReach } from './physics'
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

export type JumpWindow = {
  /** 何番目のタップか（1始まり） */
  index: number
  /** このタップを置ける最も早い stageFrame */
  first: number
  /** このタップを置ける最も遅い stageFrame */
  last: number
  /** 許容タップ窓（フレーム数）。1 ならフレームパーフェクト要求 */
  windowFrames: number
  /** 窓の中央における到達率 0..1 */
  at: number
}

export type SolveResult = {
  feasible: boolean
  /** クリアまでのフレーム数（到達不能なら -1） */
  frames: number
  /** 最小タップ数 */
  taps: number
  jumps: JumpWindow[]
  /** 最小タップ窓（フレーム） */
  minWindow: number
  /** 最小タップ窓の地点（到達率 0..1） */
  minWindowAt: number
  /** 参考: 最も遅く跳ぶ経路での窓。ギリギリの経路を選んだ場合の下限 */
  strictWindows: number[]
  /** 参考: 最も遅く跳ぶ経路での最小窓 */
  strictMinWindow: number
  /** 実際にクリアできる入力列（最も遅く跳ぶ経路のタップフレーム） */
  solutionTapFrames: number[]
  /** 最大チェイン長（着地即跳びの連鎖） */
  maxChain: number
  statesExplored: number
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
// 探索
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

class Search {
  readonly stage: StageDef
  readonly maxFrame: number
  private memo = new Map<string, number>()

  constructor(stage: StageDef) {
    this.stage = stage
    this.maxFrame = goalFrame(stage) + 8
  }

  get states(): number {
    return this.memo.size
  }

  /** 状態 s からゴールまでの最小タップ数 */
  minTaps(sim: SimState): number {
    if (sim.cleared) return 0
    if (sim.dead) return INF
    if (sim.stageFrame > this.maxFrame) return INF

    const key = stateKey(sim)
    const hit = this.memo.get(key)
    if (hit !== undefined) return hit
    if (this.memo.size > MAX_STATES) {
      throw new Error(
        `solver: 状態数が上限 ${MAX_STATES} を超えました（stage ${this.stage.id}）`,
      )
    }
    // DAG なので循環しないが、保険として先に INF を置く
    this.memo.set(key, INF)

    let best = this.minTaps(this.advance(sim, false))
    if (canJumpNow(sim.stageFrame, sim.player)) {
      const t = this.minTaps(this.advance(sim, true))
      if (t !== INF && t + 1 < best) best = t + 1
    }

    this.memo.set(key, best)
    return best
  }

  advance(sim: SimState, tap: boolean): SimState {
    const next = cloneSim(sim)
    stepSim(this.stage, next, tap)
    return next
  }
}

/**
 * ステージを解く。
 *
 * 1. 最小タップ数 T(start) を求める（突破可能性の証明）
 * 2. 最適経路上の状態だけを前方展開し、i 番目のタップを置けるフレーム集合 W_i を得る
 * 3. 最も遅く跳ぶ経路をたどり、チェイン長とクリアフレーム数を測る
 */
export function solveStage(stage: StageDef): SolveResult {
  const search = new Search(stage)
  const startSim = createSim(stage)
  const total = search.minTaps(startSim)

  if (total === INF) {
    return {
      feasible: false,
      frames: -1,
      taps: -1,
      jumps: [],
      minWindow: 0,
      minWindowAt: 0,
      strictWindows: [],
      strictMinWindow: 0,
      solutionTapFrames: [],
      maxChain: 0,
      statesExplored: search.states,
    }
  }

  // --- 2. 最適経路の和集合から W_i を求める -------------------------------
  /** タップ番号(0始まり) -> 置けるフレームの集合 */
  const tapFrames: Set<number>[] = []
  for (let i = 0; i < total; i++) tapFrames.push(new Set<number>())

  const seen = new Set<string>()
  let queue: SimState[] = [startSim]
  seen.add(stateKey(startSim))

  while (queue.length > 0) {
    const next: SimState[] = []
    for (const s of queue) {
      if (s.cleared || s.dead) continue
      const t = search.minTaps(s)
      if (t === INF) continue

      // 跳ばずに進む（タップ数が変わらないなら最適経路上）
      const noJump = search.advance(s, false)
      if (search.minTaps(noJump) === t) {
        const k = stateKey(noJump)
        if (!seen.has(k)) {
          seen.add(k)
          next.push(noJump)
        }
      }

      // ここで跳ぶ（タップ数がちょうど1減るなら最適経路上）
      if (canJumpNow(s.stageFrame, s.player)) {
        const jump = search.advance(s, true)
        if (search.minTaps(jump) === t - 1) {
          tapFrames[total - t].add(s.stageFrame)
          const k = stateKey(jump)
          if (!seen.has(k)) {
            seen.add(k)
            next.push(jump)
          }
        }
      }
    }
    queue = next
  }

  const jumps: JumpWindow[] = []
  for (let i = 0; i < total; i++) {
    const frames = [...tapFrames[i]].sort((a, b) => a - b)
    if (frames.length === 0) continue
    // 連続区間の最大長を窓とする（飛び地は数えない）
    let bestLen = 1
    let bestStart = frames[0]
    let len = 1
    let runStart = frames[0]
    for (let k = 1; k < frames.length; k++) {
      if (frames[k] === frames[k - 1] + 1) len++
      else {
        len = 1
        runStart = frames[k]
      }
      if (len > bestLen) {
        bestLen = len
        bestStart = runStart
      }
    }
    const mid = bestStart + Math.floor(bestLen / 2)
    jumps.push({
      index: i + 1,
      first: bestStart,
      last: bestStart + bestLen - 1,
      windowFrames: bestLen,
      at: progressRatio(stage, mid),
    })
  }

  let minWindow = Infinity
  let minWindowAt = 0
  const tiedAt: number[] = []
  for (const j of jumps) {
    if (j.windowFrames < minWindow) {
      minWindow = j.windowFrames
      minWindowAt = j.at
    }
  }
  for (const j of jumps) if (j.windowFrames === minWindow) tiedAt.push(j.at)
  // 最小窓が同値で並ぶ場合、クライマックス帯に入るものがあればそれを代表にする
  const inClimax = tiedAt.find(
    (a) => a >= CLIMAX_MIN_RATIO && a <= CLIMAX_MAX_RATIO,
  )
  if (inClimax !== undefined) minWindowAt = inClimax
  if (jumps.length === 0) {
    minWindow = 0
    minWindowAt = 0
  }

  // --- 3. 最も遅く跳ぶ経路（チェイン長の計測と参考値） -------------------
  let sim = startSim
  const strictWindows: number[] = []
  const groundedBefore: number[] = []
  const solutionTapFrames: number[] = []
  let run: SimState[] = []

  while (!sim.cleared && !sim.dead && sim.stageFrame <= search.maxFrame) {
    if (canJumpNow(sim.stageFrame, sim.player)) run.push(sim)
    else run = []

    const noJump = search.advance(sim, false)
    if (search.minTaps(noJump) === search.minTaps(sim)) {
      sim = noJump
      continue
    }

    const k = search.minTaps(sim)
    let w = 0
    for (let i = run.length - 1; i >= 0; i--) {
      const s = run[i]
      if (!canJumpNow(s.stageFrame, s.player)) break
      const t = search.minTaps(search.advance(s, true))
      if (t === INF || t + 1 !== k) break
      w++
    }
    strictWindows.push(w)
    solutionTapFrames.push(sim.stageFrame)
    groundedBefore.push(sim.stageFrame - sim.player.groundedSince)
    sim = search.advance(sim, true)
    run = []
  }

  let chain = 0
  let maxChain = 0
  for (let i = 0; i < groundedBefore.length; i++) {
    if (i > 0 && groundedBefore[i] <= CHAIN_GROUNDED_FRAMES) chain++
    else chain = 1
    if (chain > maxChain) maxChain = chain
  }

  return {
    feasible: sim.cleared,
    frames: sim.cleared ? sim.stageFrame : -1,
    taps: total,
    jumps,
    minWindow,
    minWindowAt,
    strictWindows,
    strictMinWindow: strictWindows.length ? Math.min(...strictWindows) : 0,
    solutionTapFrames,
    maxChain,
    statesExplored: search.states,
  }
}

// ---------------------------------------------------------------------------
// 静的検査（GDD §5-3 / §7-4 の検査3・4・5）
// ---------------------------------------------------------------------------

/** 着地できる x 区間（地面の残っている部分＋足場類）をマージして返す */
function landableIntervals(stage: StageDef): { x: number; end: number }[] {
  const raw: { x: number; end: number }[] = []
  const pits = stage.objects
    .filter((o): o is Extract<typeof o, { t: 'pit' }> => o.t === 'pit')
    .map((o) => ({ x: o.x, end: o.x + o.w }))
    .sort((a, b) => a.x - b.x)

  // 地面を谷で分割する
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

  // 検査5: worldX 昇順（描画カリングの前提）
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

  // 検査4: 安全走路（GDD §6-2）
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

  // 検査3: 配置上限（GDD §5-3）
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

  // 障害物総数（GDD §6-3 の設計値。警告のみ）
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
// 総合検査
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
  } else {
    // 検査2: 最小タップ窓
    if (solve.minWindow < budget.minTapWindowFrames) {
      issues.push({
        level: 'FAIL',
        code: 'WINDOW',
        message: `最小タップ窓 ${solve.minWindow}f が GDD §6-3 の下限 ${budget.minTapWindowFrames}f を下回ります（到達率 ${(solve.minWindowAt * 100).toFixed(1)}%）`,
      })
    }

    // 検査3: チェイン長（GDD §7-3 ルールD / §6-3）
    const chainLimit = Math.min(CHAIN_MAX, budget.maxChain)
    if (solve.maxChain > chainLimit) {
      issues.push({
        level: 'FAIL',
        code: 'CHAIN',
        message: `最大チェイン長 ${solve.maxChain} が上限 ${chainLimit} を超えます`,
      })
    }

    // 検査6: クライマックス位置（警告のみ）
    if (
      solve.minWindowAt < CLIMAX_MIN_RATIO ||
      solve.minWindowAt > CLIMAX_MAX_RATIO
    ) {
      issues.push({
        level: 'WARN',
        code: 'CLIMAX',
        message: `最小窓の地点が到達率 ${(solve.minWindowAt * 100).toFixed(1)}% で、85〜95% の外にあります`,
      })
    }
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
