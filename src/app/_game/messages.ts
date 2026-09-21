/**
 * messages.ts — 死亡メッセージ 36 本と抽選
 *
 * 出典: UIテキスト §3（全36本）/ §14-3（4本の改訂）/ §14-5（抽選ルールの改訂）
 *
 * 表示条件（UIテキスト §14-1）:
 *   - `READY` フェーズ（死亡から 300ms 後）に **1行だけ**
 *   - 画面下部。`TAP` と同一行だが **左右に分離**（描画は draw.ts `drawReadyLine`）
 *   - **タップした瞬間に消える。**待機時間はゼロ
 *
 * 抽選の3分類（UIテキスト §19-2 で確定。§3 末尾と §14-5 の記述を置き換える）:
 *   単発 ONCE     … 条件成立で1回だけ出し、以降プールから除外する
 *                   （50回解放 / 通算100 / 通算500 / `NEW BEST` の `こえた。` / D-35）
 *   優先 PRIORITY … 成立時に優先プールから抽選する（D-14 D-18 D-21 D-23 D-34）
 *   門 GATE       … 条件を満たす間だけ**通常抽選プールに存在**する。優先はしない
 *                   （D-32 D-33 D-36）
 *   分類なし      … 常時プールに存在する（残り26本。D-10 を含む）
 *
 * 判定順:
 *   1. ONCE を判定。成立すればそれを出して終了
 *   2. PRIORITY を判定。ただし**クールダウン**（直前2回で優先が発火していたら見送り）
 *   3. 通常抽選 A:B:C = 5:3:2。GATE の条件を満たさない文はプールから除外する
 *   4. 直前2回に表示した文は除外。**ONCE で出した文は除外履歴に入れない**
 *
 * `Math.random()` の使用について:
 *   本モジュールは**演出**であり、障害物の配置・挙動には一切関与しない。
 *   社長承認事項1（ゲームロジックでの乱数禁止）の対象外（GDD §5-4 の但し書きと同旨）。
 */

/** 死亡メッセージの型。`id` は UIテキストの D-xx に対応する */
export interface DeathMessage {
  id: string
  text: string
  group: 'A' | 'B' | 'C'
}

/** A 淡々型（10本）— 事実だけを置く。出現比率の基準となる中核 */
export const GROUP_A: readonly DeathMessage[] = [
  { id: 'D-01', text: 'しんだ。', group: 'A' },
  { id: 'D-02', text: 'また しんだ。', group: 'A' },
  { id: 'D-03', text: 'そこで おわり。', group: 'A' },
  { id: 'D-04', text: 'とどかなかった。', group: 'A' },
  { id: 'D-05', text: 'はやすぎた。', group: 'A' },
  { id: 'D-06', text: 'おそすぎた。', group: 'A' },
  { id: 'D-07', text: 'あたった。', group: 'A' },
  { id: 'D-08', text: 'おちた。', group: 'A' },
  { id: 'D-09', text: 'ここまで。', group: 'A' },
  // D-10 は §14-3 で改訂（旧 `ジャンプ しなかった。` 10.5 → 7.0）
  { id: 'D-10', text: 'とばなかった。', group: 'A' },
]

/** B 軽く煽る型（12本）— 行為に言及する。人格には触れない */
export const GROUP_B: readonly DeathMessage[] = [
  { id: 'D-11', text: 'もう いっかい？', group: 'B' },
  { id: 'D-12', text: 'みえて いたはず。', group: 'B' },
  { id: 'D-13', text: 'こんどは とべる。', group: 'B' },
  { id: 'D-14', text: 'また そこか。', group: 'B' },
  { id: 'D-15', text: 'まだ おぼえてない。', group: 'B' },
  { id: 'D-16', text: 'ゆびが とまった。', group: 'B' },
  { id: 'D-17', text: 'いま、ゆだんした。', group: 'B' },
  { id: 'D-18', text: 'いつもの ところ。', group: 'B' },
  { id: 'D-19', text: '1フレーム おそい。', group: 'B' },
  { id: 'D-20', text: 'わかって いたよね。', group: 'B' },
  { id: 'D-21', text: 'ここが かべ。', group: 'B' },
  { id: 'D-22', text: 'めを つぶった？', group: 'B' },
]

/** C 惜しかったと伝える型（12本）— 前進した実感を残す */
export const GROUP_C: readonly DeathMessage[] = [
  { id: 'D-23', text: 'あと すこし。', group: 'C' },
  { id: 'D-24', text: 'おしい。', group: 'C' },
  { id: 'D-25', text: 'ギリギリ だった。', group: 'C' },
  { id: 'D-26', text: '1ドット たりない。', group: 'C' },
  { id: 'D-27', text: 'かすった。', group: 'C' },
  { id: 'D-28', text: 'いい ジャンプ。', group: 'C' },
  // D-29 は §14-3 で改訂（旧 `そこまでは よかった。` 10.5 → 8.5）
  { id: 'D-29', text: 'そこまでは いい。', group: 'C' },
  { id: 'D-30', text: 'うごきは よかった。', group: 'C' },
  { id: 'D-31', text: 'つぎは こえられる。', group: 'C' },
  // D-32 は §14-3 で改訂（旧 `からだが おぼえてきた。` 11.5 → 9.5）
  { id: 'D-32', text: 'からだが おぼえた。', group: 'C' },
  // D-33 は §14-3 で改訂（旧 `よく ここまで きた。` 塊3つ → 塊2つ）
  { id: 'D-33', text: 'よく ここまで。', group: 'C' },
  { id: 'D-34', text: 'ベスト、ちかい。', group: 'C' },
]

/**
 * D 特殊条件（2本）。§19-2 で分類が分かれた。
 * - D-35 は **単発 ONCE**。通常プールには一切入れない
 * - D-36 は **門 GATE**。連続10回以上死亡している間だけ惜しい型プールに存在する
 *   （優先のままだと、詰まっている局面で36本中もっとも励ましに近い一文が連投される）
 */
export const GROUP_SPECIAL: readonly DeathMessage[] = [
  { id: 'D-35', text: 'はじめの 1ぽ。', group: 'C' },
  { id: 'D-36', text: 'まだ いける。', group: 'C' },
]

export const ALL_MESSAGES: readonly DeathMessage[] = [
  ...GROUP_A,
  ...GROUP_B,
  ...GROUP_C,
  ...GROUP_SPECIAL,
]

/** 固定文（抽選しない。§14-5 の新規固定ルール） */
export const FIXED = {
  /** 50回死亡で次ステージ解放が発火した死亡 */
  MERCY: '50かい しんだ。',
  /** 通算死亡 100 回到達 */
  DEATHS_100: 'そこまで やるか。',
  /** 通算死亡 500 回到達 */
  DEATHS_500: 'もう プロだね。',
  /** 自己ベスト到達率を更新した死亡 */
  NEW_BEST: 'こえた。',
} as const

/** 抽選に必要な文脈 */
export interface MessageContext {
  stageId: number
  /** 今回の到達率 0–100 */
  reachPct: number
  /** 死亡前の自己ベスト到達率 0–100 */
  bestPct: number
  /** 自己ベストを更新したか */
  newBest: boolean
  /** このステージの試行回数（今回を含む） */
  attempts: number
  /** 直近5回の死亡到達率（今回を含む・新しい順） */
  marks: readonly number[]
  /** 通算死亡回数（今回を含む） */
  totalDeaths: number
  /** 連続死亡回数（クリアでリセット） */
  consecutiveDeaths: number
  /** このセッション最初の死亡か（D-35 の単発条件） */
  sessionFirstDeath: boolean
  /** 50回死亡による解放がこの死亡で発火したか */
  mercyUnlock: boolean
  /**
   * 直前2回の死亡のいずれかで優先抽選が発火していたか（§19-2 クールダウン）。
   * true なら今回は優先を見送り、通常抽選に落とす。優先の発火率に 1/3 の上限が掛かり、
   * 詰まった局面でも「淡々型が最多」という設計が構造的に守られる。
   */
  priorityRecent: boolean
}

export interface PickedMessage {
  text: string
  /** 単発 ONCE で出した文。**除外履歴に入れない**（§14-5 / §19-2） */
  fixed: boolean
  /** 優先抽選から出した文。次回以降のクールダウン判定に使う */
  priority: boolean
}

/** 直近の死亡マーカーのうち、今回の到達率と ±2.0 以内に収まる数（§14-5） */
function clusteredMarks(marks: readonly number[], reachPct: number): number {
  let n = 0
  for (const m of marks) if (Math.abs(m - reachPct) <= 2.0) n++
  return n
}

const byId = (id: string): DeathMessage => {
  const m = ALL_MESSAGES.find((x) => x.id === id)
  if (!m) throw new Error(`unknown death message: ${id}`)
  return m
}

/**
 * 門 GATE（§19-2）。条件を満たす**間だけ**通常抽選プールに存在する。優先はしない。
 *
 * 3本とも「一度成立すると以後ほぼ永久に真」という性質を持つため、優先に置くと
 * そのステージ以降その1本が出続けて「淡々型を最多にする」という設計が壊れる。
 */
const GATES: Readonly<Record<string, (ctx: MessageContext) => boolean>> = {
  // 同一ステージ20回以上の挑戦
  'D-32': (c) => c.attempts >= 20,
  // ステージ3以降の死亡時のみ（安売りしない）
  'D-33': (c) => c.stageId >= 3,
  // 連続10回以上死亡している間だけ
  'D-36': (c) => c.consecutiveDeaths >= 10,
}

/** 単発 ONCE。通常プールにも優先プールにも入れない */
const ONCE_ONLY = new Set<string>(['D-35'])

/**
 * 優先 PRIORITY の候補（§19-2）。
 *
 * **入れ子条件は狭いほうを先に判定する。** 逆順だと狭いほうが永久に出ない。
 *   D-21（5つ一致）→ D-14 / D-18（3つ一致）
 *   D-34（95%以上）→ D-23（90%以上）
 * D-14 と D-18 は完全に同条件なので、**2本を並べて等確率で引く**。
 *
 * D-05 / D-06 は §14-5・§19-2 の既定どおり、GDD §4-6 の死因可視化（早押し／遅れの判別）
 * が実装されるまで**通常プールに据え置く**。
 */
function priorityCandidates(ctx: MessageContext): DeathMessage[] {
  const out: DeathMessage[] = []

  const cluster = clusteredMarks(ctx.marks, ctx.reachPct)
  if (cluster >= 5) {
    out.push(byId('D-21'))
  } else if (cluster >= 3) {
    // 等確率。どちらかに寄せない
    out.push(byId('D-14'), byId('D-18'))
  }

  if (ctx.bestPct > 0 && ctx.reachPct >= ctx.bestPct * 0.95) {
    out.push(byId('D-34'))
  } else if (ctx.bestPct > 0 && ctx.reachPct >= ctx.bestPct * 0.9) {
    out.push(byId('D-23'))
  }

  return out
}

/** 通常抽選のプール。ONCE は常に除外、GATE は条件を満たすものだけ残す */
function normalPool(ctx: MessageContext, group: 'A' | 'B' | 'C'): DeathMessage[] {
  const base =
    group === 'A' ? GROUP_A : group === 'B' ? GROUP_B : [...GROUP_C, byId('D-36')]
  return base.filter((m) => {
    if (ONCE_ONLY.has(m.id)) return false
    const gate = GATES[m.id]
    return gate ? gate(ctx) : true
  })
}

/** A:B:C = 5:3:2 */
function rollGroup(r: number): 'A' | 'B' | 'C' {
  if (r < 0.5) return 'A'
  if (r < 0.8) return 'B'
  return 'C'
}

/**
 * 死亡メッセージを1本選ぶ。
 *
 * @param recent 直前に表示した文（新しい順・2本まで見る）
 * @param rng    0以上1未満を返す乱数。演出専用（テストでは固定値を差せる）
 */
export function pickDeathMessage(
  ctx: MessageContext,
  recent: readonly string[],
  rng: () => number,
): PickedMessage {
  // --- 1. 単発 ONCE（優先順位は §14-5 の既定どおり） ----------------------
  if (ctx.mercyUnlock) return { text: FIXED.MERCY, fixed: true, priority: false }
  if (ctx.totalDeaths === 100) return { text: FIXED.DEATHS_100, fixed: true, priority: false }
  if (ctx.totalDeaths === 500) return { text: FIXED.DEATHS_500, fixed: true, priority: false }
  if (ctx.newBest) return { text: FIXED.NEW_BEST, fixed: true, priority: false }
  if (ctx.sessionFirstDeath) return { text: byId('D-35').text, fixed: true, priority: false }

  const blocked = new Set(recent.slice(0, 2))
  const usable = (list: DeathMessage[]) => list.filter((m) => !blocked.has(m.text))

  // --- 2. 優先 PRIORITY（クールダウン付き） -------------------------------
  if (!ctx.priorityRecent) {
    const priority = usable(priorityCandidates(ctx))
    if (priority.length > 0) {
      return {
        text: priority[Math.floor(rng() * priority.length)].text,
        fixed: false,
        priority: true,
      }
    }
  }

  // --- 3. 通常抽選（A:B:C = 5:3:2） --------------------------------------
  const first = rollGroup(rng())
  const order: ('A' | 'B' | 'C')[] = [first, 'A', 'B', 'C']
  for (const g of order) {
    const pool = usable(normalPool(ctx, g))
    if (pool.length > 0) {
      return { text: pool[Math.floor(rng() * pool.length)].text, fixed: false, priority: false }
    }
  }
  // 理論上到達しない（36本に対し除外は2本まで）
  return { text: GROUP_A[0].text, fixed: false, priority: false }
}
