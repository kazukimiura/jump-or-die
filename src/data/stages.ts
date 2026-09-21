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
 * GDD §6-3 の表。全10ステージぶん定義しておく（ソルバの合否基準）。
 * S4〜S10 のステージ実体は本幕のスコープ外。
 */
export const STAGE_BUDGETS: Record<number, StageBudget> = {
  1: { objectCount: 11, maxChain: 1, minTapWindowFrames: 20, climaxAt: 0.88 },
  2: { objectCount: 17, maxChain: 2, minTapWindowFrames: 18, climaxAt: 0.9 },
  3: { objectCount: 23, maxChain: 2, minTapWindowFrames: 16, climaxAt: 0.86 },
  4: { objectCount: 30, maxChain: 3, minTapWindowFrames: 14, climaxAt: 0.91 },
  5: { objectCount: 34, maxChain: 3, minTapWindowFrames: 12, climaxAt: 0.88 },
  6: { objectCount: 43, maxChain: 4, minTapWindowFrames: 10, climaxAt: 0.92 },
  7: { objectCount: 47, maxChain: 4, minTapWindowFrames: 9, climaxAt: 0.89 },
  8: { objectCount: 58, maxChain: 5, minTapWindowFrames: 7, climaxAt: 0.93 },
  9: { objectCount: 72, maxChain: 5, minTapWindowFrames: 6, climaxAt: 0.9 },
  10: { objectCount: 90, maxChain: 5, minTapWindowFrames: 4, climaxAt: 0.95 },
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
// 構成: 既習の確認 → ①紹介 1150 → ②反復 1560・1970 → ③応用 2350〜2980
//       → ④試験 3350〜 の TWIN（着地即跳び＝チェイン2）
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
    { t: 'block', x: 2600, w: 24, h: 32 },
    { t: 'block', x: 2780, w: 12, h: 16 },
    { t: 'block', x: 2980, w: 12, h: 16 },
    // ④ 試験 — TWIN。着地から間を置かずに次を跳ぶ（チェイン2）
    { t: 'block', x: 3350, w: 12, h: 16 },
    { t: 'block', x: 3480, w: 12, h: 16 },
    { t: 'block', x: 3820, w: 24, h: 32 },
    { t: 'block', x: 3960, w: 12, h: 16 },
    { t: 'block', x: 4300, w: 12, h: 16 },
    { t: 'block', x: 4430, w: 12, h: 16 },
    // クライマックス 到達率 90%台 — ブロック大の直後に締めの一本
    { t: 'block', x: 4700, w: 24, h: 32 },
    { t: 'block', x: 4870, w: 12, h: 16 },
  ],
}

// ---------------------------------------------------------------------------
// S3 THE GAP — 速度 3.00 px/f / 35秒 / 6,300px
// 新規ギミック: OB-03 谷 / OB-06 トゲ床。最大チェイン 2
// ルールC（単一原因）に従い、谷とトゲを同時に初見で出さない。
//   谷: ①1200 ②1560/1900 ③2250（ブロック併用）
//   トゲ: ①2850 ②3150/3450 ③3990（谷の直後）
// クライマックス 到達率 86% の長跳び（P-E）。0.5s 手前に warn マーカーを置く
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
    { t: 'block', x: 800, w: 24, h: 32 },
    // ① 紹介 — OB-03 谷。最小幅からはじめる
    { t: 'pit', x: 1200, w: 32 },
    // ② 反復 — 同じ形を2回、少しずつ広げる
    { t: 'pit', x: 1560, w: 40 },
    { t: 'pit', x: 1900, w: 48 },
    // ③ 応用 — 谷 + 既習ブロック
    { t: 'pit', x: 2250, w: 56 },
    { t: 'block', x: 2480, w: 12, h: 16 },
    // ① 紹介 — OB-06 トゲ床。単独で置く（ルールC: 未知を2つ同時に出さない）
    { t: 'spike', x: 2850, n: 2 },
    // ② 反復
    { t: 'spike', x: 3150, n: 2 },
    { t: 'spike', x: 3450, n: 3 },
    // ③ 応用 — 谷 + トゲ / トゲ + ブロック
    { t: 'pit', x: 3800, w: 64 },
    { t: 'spike', x: 3990, n: 3 },
    { t: 'block', x: 4300, w: 24, h: 32 },
    { t: 'spike', x: 4520, n: 2 },
    // ④ 試験 — 高密度。着地即跳び（チェイン2）を混ぜる
    { t: 'pit', x: 4800, w: 72 },
    { t: 'block', x: 5000, w: 12, h: 16 },
    { t: 'spike', x: 5150, n: 3 },
    { t: 'block', x: 5290, w: 12, h: 16 },
    // 予告マーカー（ルールB）— クライマックスの 0.5秒（90px）手前
    { t: 'warn', x: 5330 },
    // クライマックス 到達率 86% — 長跳び P-E
    { t: 'pit', x: 5420, w: 80 },
    { t: 'spike', x: 5620, n: 3 },
    // 締め — 既習のブロックだけで終わらせる
    { t: 'block', x: 5860, w: 12, h: 16 },
    { t: 'block', x: 6040, w: 12, h: 16 },
    { t: 'block', x: 6200, w: 12, h: 16 },
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
