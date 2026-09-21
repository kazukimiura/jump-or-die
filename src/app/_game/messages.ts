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
 * 抽選の優先順位（UIテキスト §14-5）:
 *   50回解放 > 通算100/500回 > `NEW BEST` > 条件付き抽選 > 通常抽選（A:B:C = 5:3:2）
 *   - 直前2回に表示した文は必ず除外する
 *   - **固定ルールで出した文は除外履歴に入れない**（次の通常抽選を不当に狭めるため）
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

/** D 特殊条件（2本）— 条件が成立したときだけ抽選対象になる */
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
  /** このセッション最初の死亡か */
  sessionFirstDeath: boolean
  /** 50回死亡による解放がこの死亡で発火したか */
  mercyUnlock: boolean
}

export interface PickedMessage {
  text: string
  /** 固定ルールで出した文は除外履歴に入れない（§14-5） */
  fixed: boolean
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
 * 条件付き抽選の候補（§14-5）。
 *
 * D-33 は「ステージ3以降の死亡時のみ出現」だが、これは**出現の門**であって
 * 優先トリガではないと解釈し、通常抽選側のフィルタに回している。
 * 優先プールに入れると S3 では常時成立して淡々型がほぼ出なくなり、
 * §3 の「淡々型を最多にするのが肝」という設計意図と衝突するため。
 * 同様に D-05 / D-06 は §14-5 の指示どおり（死因可視化の実装前）通常抽選に含める。
 */
function priorityCandidates(ctx: MessageContext): DeathMessage[] {
  const out: DeathMessage[] = []
  const cluster = clusteredMarks(ctx.marks, ctx.reachPct)

  // セッション初回の死亡時のみ
  if (ctx.sessionFirstDeath) out.push(byId('D-35'))
  // 連続10回以上死亡している時
  if (ctx.consecutiveDeaths >= 10) out.push(byId('D-36'))
  // 直近5回の死亡マーカーのうち3つが到達率 ±2.0 以内
  if (cluster >= 3) {
    out.push(byId('D-14'))
    out.push(byId('D-18'))
  }
  // 5つすべてが ±2.0 以内
  if (cluster >= 5) out.push(byId('D-21'))
  // 到達率が自己ベストの90% / 95% 以上
  if (ctx.bestPct > 0 && ctx.reachPct >= ctx.bestPct * 0.9) out.push(byId('D-23'))
  if (ctx.bestPct > 0 && ctx.reachPct >= ctx.bestPct * 0.95) out.push(byId('D-34'))
  // 同一ステージ20回以上の挑戦
  if (ctx.attempts >= 20) out.push(byId('D-32'))

  return out
}

/** 通常抽選の母集団。D-33 はステージ3以降でのみ含める */
function normalPool(ctx: MessageContext, group: 'A' | 'B' | 'C'): DeathMessage[] {
  const base = group === 'A' ? GROUP_A : group === 'B' ? GROUP_B : GROUP_C
  return base.filter((m) => (m.id === 'D-33' ? ctx.stageId >= 3 : true))
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
  // --- 固定ルール（優先順位順） -------------------------------------------
  if (ctx.mercyUnlock) return { text: FIXED.MERCY, fixed: true }
  if (ctx.totalDeaths === 100) return { text: FIXED.DEATHS_100, fixed: true }
  if (ctx.totalDeaths === 500) return { text: FIXED.DEATHS_500, fixed: true }
  if (ctx.newBest) return { text: FIXED.NEW_BEST, fixed: true }

  const blocked = new Set(recent.slice(0, 2))
  const usable = (list: DeathMessage[]) => list.filter((m) => !blocked.has(m.text))

  // --- 条件付き抽選 -------------------------------------------------------
  const priority = usable(priorityCandidates(ctx))
  if (priority.length > 0) {
    return { text: priority[Math.floor(rng() * priority.length)].text, fixed: false }
  }

  // --- 通常抽選（A:B:C = 5:3:2） -----------------------------------------
  const first = rollGroup(rng())
  const order: ('A' | 'B' | 'C')[] = [first, 'A', 'B', 'C']
  for (const g of order) {
    const pool = usable(normalPool(ctx, g))
    if (pool.length > 0) {
      return { text: pool[Math.floor(rng() * pool.length)].text, fixed: false }
    }
  }
  // 理論上到達しない（36本に対し除外は2本まで）
  return { text: GROUP_A[0].text, fixed: false }
}
