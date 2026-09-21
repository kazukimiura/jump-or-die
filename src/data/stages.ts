/**
 * JumpOrDie — ステージデータ
 *
 * 出典: GDD §6-2（基本諸元）/ §6-3（密度・ギミック・窓）/ §7-1（データ構造）
 *       / §7-2（複合パターンの語彙）/ §7-3（初見殺しの運用ルール）
 *
 * 【スコープ】社長承認 2026-09-21 により、本幕の実装は S1〜S3 のみ。
 * ただし S4〜S10 は `STAGE_BUDGETS` に諸元が入っており、
 * `STAGES` 配列へ `StageDef` を追加するだけで差し込める構造にしてある。
 *
 * 【絶対条件】
 * - `objects` は worldX の昇順（描画カリングの前提。ソルバ検査5）
 * - 開始直後に safeRunwayPx ぶんの安全走路を必ず置く（ソルバ検査4）
 * - 乱数を一切使わない。すべて静的データ（GDD §12-6 / 社長承認事項1）
 */

import type { StageBudget, StageDef } from '@/lib/game/types'

/**
 * GDD §6-3 の表（2026-09-21 §14-② 改訂版）。全10ステージぶん定義しておく。
 * 生存窓は「下限のみ」から **下限と上限を持つ帯** に変わっている。
 * S4〜S10 のステージ実体は本幕のスコープ外。
 */
export const STAGE_BUDGETS: Record<number, StageBudget> = {
  1: { objectCount: 11, maxChain: 1, windowMinFrames: 20, windowMaxFrames: 40, climaxAt: 0.88, climaxWarnOnly: true, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1] },
  2: { objectCount: 17, maxChain: 2, windowMinFrames: 18, windowMaxFrames: 32, climaxAt: 0.9, climaxWarnOnly: false, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1] },
  3: { objectCount: 23, maxChain: 2, windowMinFrames: 16, windowMaxFrames: 26, climaxAt: 0.86, climaxWarnOnly: false, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1] },
  4: { objectCount: 30, maxChain: 3, windowMinFrames: 14, windowMaxFrames: 22, climaxAt: 0.91, climaxWarnOnly: false, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1] },
  5: { objectCount: 34, maxChain: 3, windowMinFrames: 12, windowMaxFrames: 19, climaxAt: 0.88, climaxWarnOnly: false, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1] },
  6: { objectCount: 43, maxChain: 4, windowMinFrames: 10, windowMaxFrames: 16, climaxAt: 0.92, climaxWarnOnly: false, tightDensity: [0.05, 0.12], suppressRatio: [0.05, 0.15], compositeRatio: [0.1, 0.2] },
  7: { objectCount: 47, maxChain: 4, windowMinFrames: 9, windowMaxFrames: 14, climaxAt: 0.89, climaxWarnOnly: false, tightDensity: [0.05, 0.12], suppressRatio: [0.05, 0.15], compositeRatio: [0.1, 0.2] },
  8: { objectCount: 58, maxChain: 5, windowMinFrames: 7, windowMaxFrames: 11, climaxAt: 0.93, climaxWarnOnly: false, tightDensity: [0.05, 0.12], suppressRatio: [0.05, 0.15], compositeRatio: [0.1, 0.2] },
  9: { objectCount: 72, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 9, climaxAt: 0.9, climaxWarnOnly: false, tightDensity: [0.05, 0.12], suppressRatio: [0.05, 0.15], compositeRatio: [0.1, 0.2] },
  10: { objectCount: 90, maxChain: 5, windowMinFrames: 4, windowMaxFrames: 7, climaxAt: 0.95, climaxWarnOnly: false, tightDensity: [0.05, 0.12], suppressRatio: [0.05, 0.15], compositeRatio: [0.1, 0.2] },
}

// ---------------------------------------------------------------------------
// S1 FIRST STEP — 速度 2.50 px/f / 25秒 / 3,750px
// 新規ギミック: OB-01 ブロック小のみ。最大チェイン 1（跳びっぱなしにしない）
// 構成: ①紹介 400 / ②反復 700・1000 / ③応用 1300〜2900 / ④試験 3300（二連）
// ---------------------------------------------------------------------------
const STAGE_1: StageDef = {
  id: 1,
  name: 'FIRST STEP',
  speedPxPerFrame: 2.5,
  lengthPx: 3750,
  safeRunwayPx: 120,
  groundY: 148,
  objects: [
    // ① 紹介 — 単独。前後に余白をたっぷり取る
    { t: 'block', x: 400, w: 12, h: 16 },
    // ② 反復 — 全く同じ形を2回。手癖にする
    { t: 'block', x: 700, w: 12, h: 16 },
    { t: 'block', x: 1000, w: 12, h: 16 },
    // ③ 応用 — 間隔を少しずつ詰めてリズムを作る
    { t: 'block', x: 1300, w: 12, h: 16 },
    { t: 'block', x: 1600, w: 12, h: 16 },
    { t: 'block', x: 1900, w: 12, h: 16 },
    { t: 'block', x: 2200, w: 12, h: 16 },
    { t: 'block', x: 2550, w: 12, h: 16 },
    { t: 'block', x: 2900, w: 12, h: 16 },
    // ④ 試験 — 到達率 88% のクライマックス。二連で幅24pxの壁になる
    { t: 'block', x: 3300, w: 12, h: 16 },
    { t: 'block', x: 3312, w: 12, h: 16 },
  ],
}

// ---------------------------------------------------------------------------
// S2 TWIN BLOCK — 速度 2.75 px/f / 30秒 / 4,950px
// 新規ギミック: OB-02 ブロック大（24x32）。最大チェイン 2
// 構成: 既習の確認 → ①紹介 1150 → ②反復 1560・1970 → ③応用 2350〜2900
//       → ④試験 3200〜 → クライマックス 4300〜（D(t) ピーク 88%）
//
// 【間隔の下限について — 誤帰属距離 0 の維持（GDD §14-8）】
// ブロックは上面に着地できる（§4-4）ため、対の1本目の上に乗ると 2本目が
// 間に合わなくなり「1本目は越えたのに2本目で死ぬ」遅延死が発生する。
// ソルバで実測した速度 2.75 における安全な最小間隔は以下のとおりで、
// 本ステージの全隣接ペアはこれを満たしている。
//   小→小 155px / 小→大 165px / 大→小 175px / 大→大 185px
// ---------------------------------------------------------------------------
const STAGE_2: StageDef = {
  id: 2,
  name: 'TWIN BLOCK',
  speedPxPerFrame: 2.75,
  lengthPx: 4950,
  safeRunwayPx: 132,
  groundY: 148,
  objects: [
    // 既習（OB-01）の確認。速度が上がったことに慣れさせる
    { t: 'block', x: 420, w: 12, h: 16 },
    { t: 'block', x: 760, w: 12, h: 16 },
    // ① 紹介 — OB-02 ブロック大。前後に 1.5s 以上の余白
    { t: 'block', x: 1150, w: 24, h: 32 },
    // ② 反復 — 同じ形を2回
    { t: 'block', x: 1560, w: 24, h: 32 },
    { t: 'block', x: 1970, w: 24, h: 32 },
    // ③ 応用 — 既習の小ブロックと組み合わせる
    { t: 'block', x: 2350, w: 12, h: 16 },
    { t: 'block', x: 2620, w: 24, h: 32 },
    { t: 'block', x: 2900, w: 12, h: 16 },
    // ④ 試験 — TWIN。140px 間隔の対が「着地即跳び」＝連鎖2 を作る
    { t: 'block', x: 3200, w: 12, h: 16 },
    { t: 'block', x: 3480, w: 12, h: 16 },
    { t: 'block', x: 3640, w: 12, h: 16 },
    { t: 'block', x: 3900, w: 24, h: 32 },
    { t: 'block', x: 4080, w: 12, h: 16 },
    // 予告マーカー（§7-3 ルールB）— クライマックスの 0.5秒（165px）手前
    { t: 'warn', x: 4160 },
    // クライマックス（到達率 88%）— ブロック大を3本、2.0秒窓（120f）に収めて
    // D(t) のピークを作る。190px で連鎖2、215px で連鎖を切る（§6-3 の上限2を守る）
    { t: 'block', x: 4300, w: 24, h: 32 },
    { t: 'block', x: 4490, w: 24, h: 32 },
    { t: 'block', x: 4705, w: 24, h: 32 },
    // 締め
    { t: 'block', x: 4885, w: 12, h: 16 },
  ],
}

// ---------------------------------------------------------------------------
// S3 THE GAP — 速度 3.00 px/f / 35秒 / 6,300px
// 新規ギミック: OB-03 谷 / OB-06 トゲ床。最大チェイン 2
// ルールC（単一原因）に従い、谷とトゲを同時に初見で出さない。
//   谷:   ①1250 ②1580/1910 ③2240（ブロック併用）
//   トゲ: ①3070 ②3350/3630 ③4240（谷の直後）
// クライマックス 到達率 88% の長跳び（P-E）。0.5s 手前に warn マーカーを置く
//
// 【間隔の下限について — 誤帰属距離 0 の維持（GDD §14-8）】
// ソルバで実測した速度 3.0 における安全な最小間隔:
//   小→小 165px / 小→大 175px / 大→小 185px / 小→トゲ 160px
//   トゲ→小 135px / 谷56→小 200px / 谷64→小 205px / 谷80→小 225px
// 谷はジャンプ位置が縁に張り付き着地点が +126px ずれるため、後続を大きく空ける。
// ---------------------------------------------------------------------------
const STAGE_3: StageDef = {
  id: 3,
  name: 'THE GAP',
  speedPxPerFrame: 3.0,
  lengthPx: 6300,
  safeRunwayPx: 144,
  groundY: 148,
  objects: [
    // 既習（OB-01 / OB-02）の確認
    { t: 'block', x: 460, w: 12, h: 16 },
    { t: 'block', x: 640, w: 24, h: 32 },
    { t: 'block', x: 900, w: 12, h: 16 },
    // ① 紹介 — OB-03 谷。最小幅からはじめる（前後に 1.5s = 270px 以上の余白）
    { t: 'pit', x: 1250, w: 32 },
    // ② 反復 — 同じ形を2回、少しずつ広げる
    { t: 'pit', x: 1580, w: 40 },
    { t: 'pit', x: 1910, w: 48 },
    // ③ 応用 — 広い谷 + 既習ブロック
    { t: 'pit', x: 2240, w: 56 },
    { t: 'block', x: 2550, w: 12, h: 16 },
    { t: 'block', x: 2720, w: 12, h: 16 },
    // ① 紹介 — OB-06 トゲ床。単独で置く（ルールC: 未知を2つ同時に出さない）
    { t: 'spike', x: 3070, n: 2 },
    // ② 反復
    { t: 'spike', x: 3350, n: 2 },
    { t: 'spike', x: 3630, n: 3 },
    // ③ 応用 — 谷 + トゲ + ブロック
    { t: 'pit', x: 3930, w: 64 },
    { t: 'spike', x: 4240, n: 3 },
    { t: 'block', x: 4390, w: 12, h: 16 },
    // ④ 試験 — 高密度
    { t: 'block', x: 4670, w: 24, h: 32 },
    { t: 'block', x: 4950, w: 12, h: 16 },
    { t: 'spike', x: 5120, n: 2 },
    // 予告マーカー（ルールB）— クライマックスの 0.5秒（180px）手前
    { t: 'warn', x: 5220 },
    // クライマックス（到達率 88% 付近）— 長跳び P-E から 2.0秒窓に3本を収める
    { t: 'pit', x: 5400, w: 80 },
    { t: 'block', x: 5630, w: 12, h: 16 },
    { t: 'spike', x: 5850, n: 3 },
    // 締め
    { t: 'block', x: 6060, w: 12, h: 16 },
    { t: 'block', x: 6230, w: 12, h: 16 },
  ],
}

/** 本幕で実装するステージ（S1〜S3）。S4〜S10 はここへ追加するだけで拡張できる */
export const STAGES: StageDef[] = [STAGE_1, STAGE_2, STAGE_3]

export function getStage(id: number): StageDef | undefined {
  return STAGES.find((s) => s.id === id)
}

export function getBudget(id: number): StageBudget | undefined {
  return STAGE_BUDGETS[id]
}
