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
  1: { objectCount: 11, maxChain: 1, windowMinFrames: 20, windowMaxFrames: 40, climaxAt: 0.88, climaxWarnOnly: true, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1], tapsPerSecond: 0.4 },
  2: { objectCount: 17, maxChain: 2, windowMinFrames: 18, windowMaxFrames: 32, climaxAt: 0.9, climaxWarnOnly: false, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1], tapsPerSecond: 0.48 },
  3: { objectCount: 23, maxChain: 2, windowMinFrames: 16, windowMaxFrames: 26, climaxAt: 0.86, climaxWarnOnly: false, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1], tapsPerSecond: 0.55 },
  4: { objectCount: 30, maxChain: 3, windowMinFrames: 14, windowMaxFrames: 22, climaxAt: 0.91, climaxWarnOnly: false, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1], tapsPerSecond: 0.62 },
  5: { objectCount: 34, maxChain: 3, windowMinFrames: 12, windowMaxFrames: 19, climaxAt: 0.88, climaxWarnOnly: false, tightDensity: [0.0, 0.05], suppressRatio: [0.0, 0.1], compositeRatio: [0.0, 0.1], tapsPerSecond: 0.68 },
  6: { objectCount: 43, maxChain: 4, windowMinFrames: 10, windowMaxFrames: 16, climaxAt: 0.92, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25], tapsPerSecond: 0.75 },
  7: { objectCount: 47, maxChain: 4, windowMinFrames: 9, windowMaxFrames: 14, climaxAt: 0.89, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25], tapsPerSecond: 0.82 },
  8: { objectCount: 58, maxChain: 5, windowMinFrames: 8, windowMaxFrames: 12, climaxAt: 0.93, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25], tapsPerSecond: 0.9 },
  9: { objectCount: 72, maxChain: 5, windowMinFrames: 11, windowMaxFrames: 13, climaxAt: 0.9, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25], tapsPerSecond: 1.0 },
  10: { objectCount: 90, maxChain: 5, windowMinFrames: 11, windowMaxFrames: 13, climaxAt: 0.95, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25], tapsPerSecond: 1.1 },
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

// ---------------------------------------------------------------------------
// S4 LOW SKY — 速度 3.25 px/f / 40秒 / 7,785px
// 新規ギミック: OB-04 天井
// 2026-09-22 §15-15 の間引き: 障害物 31 → 30（-1）。
//   中盤の反復区間のみを種別比を保って間引き、クライマックス帯（85%〜）は無改変。
//   間隔は縮めず、消えた区間の元の間隔の最大値を採って詰めた。
// 実測: 生存窓 17f / 最悪 17f / 連鎖 2 /
//   狭窓密度 0.000 / 抑制率 0.069 / 複合度 0.000 /
//   D(t) 3.64 @92.3% / タップ 27本 = 0.68/秒（構造上限 1.11）
// ---------------------------------------------------------------------------
const STAGE_4: StageDef = {
  id: 4,
  name: 'LOW SKY',
  speedPxPerFrame: 3.25,
  lengthPx: 7785,
  safeRunwayPx: 156,
  groundY: 148,
  objects: [
    { t: 'block', x: 286, w: 12, h: 16 },
    { t: 'block', x: 501, w: 24, h: 32 },
    { t: 'pit', x: 768, w: 48 },
    { t: 'spike', x: 1073, n: 2 },
    // 予告マーカー（ルールB）
    { t: 'warn', x: 1240 },
    { t: 'ceil', x: 1370, w: 48, y: 96 },
    { t: 'block', x: 1621, w: 12, h: 16 },
    { t: 'ceil', x: 1849, w: 48, y: 96 },
    { t: 'pit', x: 2140, w: 56 },
    { t: 'spike', x: 2453, n: 3 },
    { t: 'block', x: 2693, w: 24, h: 32 },
    { t: 'block', x: 2947, w: 12, h: 16 },
    { t: 'pit', x: 3189, w: 56 },
    { t: 'block', x: 3502, w: 12, h: 16 },
    { t: 'spike', x: 3744, n: 2 },
    { t: 'block', x: 3990, w: 12, h: 16 },
    { t: 'block', x: 4232, w: 24, h: 32 },
    { t: 'spike', x: 4486, n: 2 },
    { t: 'pit', x: 4732, w: 56 },
    { t: 'block', x: 5045, w: 12, h: 16 },
    { t: 'spike', x: 5287, n: 2 },
    { t: 'block', x: 5533, w: 12, h: 16 },
    { t: 'block', x: 5775, w: 24, h: 32 },
    { t: 'spike', x: 6029, n: 2 },
    { t: 'block', x: 6275, w: 12, h: 16 },
    { t: 'spike', x: 6517, n: 3 },
    // クライマックス帯（到達率 85〜95%）— §15-15 の間引きでも構造を保存した区間
    { t: 'block', x: 6771, w: 12, h: 16 },
    { t: 'pit', x: 7040, w: 104 },
    { t: 'block', x: 7401, w: 12, h: 16 },
    { t: 'spike', x: 7605, n: 3 },
  ],
}

// ---------------------------------------------------------------------------
// S5 TEST I — 速度 3.5 px/f / 39秒 / 8,176px
// 新規ギミック: 章I 章末試験（新規なし）
// 2026-09-22 §15-15 の間引き: 障害物 35 → 29（-6）。
//   中盤の反復区間のみを種別比を保って間引き、クライマックス帯（85%〜）は無改変。
//   間隔は縮めず、消えた区間の元の間隔の最大値を採って詰めた。
// 実測: 生存窓 15f / 最悪 15f / 連鎖 2 /
//   狭窓密度 0.000 / 抑制率 0.069 / 複合度 0.000 /
//   D(t) 4.04 @87.8% / タップ 27本 = 0.69/秒（構造上限 1.11）
// ---------------------------------------------------------------------------
const STAGE_5: StageDef = {
  id: 5,
  name: 'TEST I',
  speedPxPerFrame: 3.5,
  lengthPx: 8176,
  safeRunwayPx: 168,
  groundY: 148,
  objects: [
    { t: 'block', x: 308, w: 12, h: 16 },
    { t: 'spike', x: 539, n: 2 },
    { t: 'block', x: 789, w: 24, h: 32 },
    { t: 'pit', x: 1061, w: 60 },
    { t: 'block', x: 1398, w: 12, h: 16 },
    { t: 'ceil', x: 1644, w: 48, y: 96 },
    { t: 'spike', x: 1926, n: 3 },
    { t: 'block', x: 2184, w: 12, h: 16 },
    { t: 'pit', x: 2430, w: 72 },
    { t: 'spike', x: 2779, n: 2 },
    { t: 'block', x: 3021, w: 12, h: 16 },
    { t: 'ceil', x: 3281, w: 64, y: 96 },
    { t: 'block', x: 3579, w: 12, h: 16 },
    { t: 'pit', x: 3825, w: 84 },
    { t: 'spike', x: 4186, n: 3 },
    { t: 'block', x: 4436, w: 12, h: 16 },
    { t: 'block', x: 4725, w: 12, h: 16 },
    { t: 'spike', x: 4963, n: 3 },
    { t: 'block', x: 5221, w: 12, h: 16 },
    { t: 'block', x: 5467, w: 24, h: 32 },
    { t: 'spike', x: 5722, n: 2 },
    { t: 'pit', x: 5972, w: 104 },
    { t: 'spike', x: 6353, n: 3 },
    { t: 'block', x: 6603, w: 12, h: 16 },
    { t: 'block', x: 6849, w: 24, h: 32 },
    // クライマックス帯（到達率 85〜95%）— §15-15 の間引きでも構造を保存した区間
    { t: 'spike', x: 7104, n: 2 },
    { t: 'pit', x: 7368, w: 120 },
    { t: 'block', x: 7765, w: 12, h: 16 },
    { t: 'spike', x: 7984, n: 3 },
  ],
}

// ---------------------------------------------------------------------------
// S6 FLOATING — 速度 3.75 px/f / 53秒 / 12,023px
// 新規ギミック: OB-05 浮遊足場
// 2026-09-22 §15-15 の間引き: 障害物 43 → 30（-13）。
//   中盤の反復区間のみを種別比を保って間引き、クライマックス帯（85%〜）は無改変。
//   間隔は縮めず、消えた区間の元の間隔の最大値を採って詰めた。
// 実測: 生存窓 12f / 最悪 11f / 連鎖 4 /
//   狭窓密度 0.075 / 抑制率 0.138 / 複合度 0.000 /
//   D(t) 4.81 @91.0% / タップ 23本 = 0.43/秒（構造上限 1.03）
// ---------------------------------------------------------------------------
const STAGE_6: StageDef = {
  id: 6,
  name: 'FLOATING',
  speedPxPerFrame: 3.75,
  lengthPx: 12023,
  safeRunwayPx: 180,
  groundY: 148,
  objects: [
    { t: 'block', x: 330, w: 12, h: 16 },
    { t: 'pit', x: 693, w: 64 },
    { t: 'spike', x: 1201, n: 2 },
    { t: 'block', x: 1568, w: 24, h: 32 },
    // 予告マーカー（ルールB）
    { t: 'warn', x: 1961 },
    { t: 'plat', x: 2179, y: 112 },
    { t: 'block', x: 2562, w: 12, h: 16 },
    { t: 'plat', x: 2925, y: 112 },
    { t: 'spike', x: 3308, n: 3 },
    { t: 'ceil', x: 3683, w: 48, y: 96 },
    { t: 'ceil', x: 4270, w: 48, y: 96 },
    { t: 'block', x: 4762, w: 12, h: 16 },
    { t: 'plat', x: 5125, y: 104 },
    { t: 'ceil', x: 5696, w: 48, y: 96 },
    { t: 'block', x: 6095, w: 12, h: 16 },
    { t: 'pit', x: 6482, w: 121 },
    { t: 'spike', x: 7047, n: 3 },
    { t: 'block', x: 7422, w: 24, h: 32 },
    { t: 'plat', x: 7815, y: 104 },
    { t: 'ceil', x: 8386, w: 48, y: 96 },
    { t: 'spike', x: 8878, n: 3 },
    { t: 'block', x: 9241, w: 12, h: 16 },
    { t: 'plat', x: 9622, y: 112 },
    { t: 'spike', x: 10005, n: 2 },
    // クライマックス帯（到達率 85〜95%）— §15-15 の間引きでも構造を保存した区間
    { t: 'block', x: 10360, w: 12, h: 16 },
    { t: 'pit', x: 10747, w: 140 },
    { t: 'spike', x: 11183, n: 3 },
    { t: 'block', x: 11394, w: 12, h: 16 },
    { t: 'spike', x: 11628, n: 2 },
    { t: 'block', x: 11831, w: 12, h: 16 },
  ],
}

// ---------------------------------------------------------------------------
// S7 THE LIFT — 速度 4 px/f / 54秒 / 13,005px
// 新規ギミック: OB-07 昇降 / OB-10 バネ
// 2026-09-22 §15-15 の間引き: 障害物 49 → 35（-14）。
//   中盤の反復区間のみを種別比を保って間引き、クライマックス帯（85%〜）は無改変。
//   間隔は縮めず、消えた区間の元の間隔の最大値を採って詰めた。
// 実測: 生存窓 11f / 最悪 11f / 連鎖 2 /
//   狭窓密度 0.018 / 抑制率 0.129 / 複合度 0.031 /
//   D(t) 5.32 @91.3% / タップ 24本 = 0.44/秒（構造上限 1.03）
// ---------------------------------------------------------------------------
const STAGE_7: StageDef = {
  id: 7,
  name: 'THE LIFT',
  speedPxPerFrame: 4,
  lengthPx: 13005,
  safeRunwayPx: 192,
  groundY: 148,
  objects: [
    { t: 'block', x: 352, w: 12, h: 16 },
    { t: 'pit', x: 684, w: 72 },
    { t: 'spike', x: 1184, n: 2 },
    { t: 'plat', x: 1516, y: 112 },
    // 予告マーカー（ルールB）
    { t: 'warn', x: 1887 },
    { t: 'lift', x: 2098, y: 132, amp: 24, period: 90, phase: 0 },
    { t: 'block', x: 2453, w: 12, h: 16 },
    { t: 'lift', x: 2785, y: 132, amp: 24, period: 90, phase: 30 },
    { t: 'spike', x: 3140, n: 3 },
    // 予告マーカー（ルールB）
    { t: 'warn', x: 3416 },
    { t: 'spring', x: 3627 },
    { t: 'block', x: 3978, w: 12, h: 16 },
    { t: 'ceil', x: 4329, w: 48, y: 96 },
    { t: 'ceil', x: 4851, w: 48, y: 96 },
    { t: 'lift', x: 5255, y: 124, amp: 32, period: 100, phase: 0 },
    { t: 'ceil', x: 5610, w: 48, y: 96 },
    { t: 'block', x: 5997, w: 12, h: 16 },
    { t: 'plat', x: 6437, y: 104 },
    { t: 'spring', x: 6808 },
    { t: 'lift', x: 7147, y: 132, amp: 24, period: 80, phase: 20 },
    { t: 'spike', x: 7502, n: 3 },
    { t: 'block', x: 7830, w: 12, h: 16 },
    { t: 'pit', x: 8181, w: 130 },
    { t: 'block', x: 8739, w: 24, h: 32 },
    { t: 'ceil', x: 9119, w: 48, y: 96 },
    { t: 'spike', x: 9595, n: 3 },
    { t: 'block', x: 9923, w: 12, h: 16 },
    { t: 'block', x: 10291, w: 12, h: 16 },
    { t: 'spike', x: 10623, n: 2 },
    { t: 'pit', x: 10978, w: 130 },
    // クライマックス帯（到達率 85〜95%）— §15-15 の間引きでも構造を保存した区間
    { t: 'block', x: 11536, w: 12, h: 16 },
    { t: 'block', x: 11785, w: 24, h: 32 },
    { t: 'pit', x: 12073, w: 150 },
    { t: 'block', x: 12540, w: 12, h: 16 },
    { t: 'spike', x: 12789, n: 3 },
  ],
}

// ---------------------------------------------------------------------------
// S8 FIRST WINGS — 速度 4.25 px/f / 54秒 / 13,850px
// 新規ギミック: OB-08 飛行体（vx=1.0）
// 2026-09-22 §15-15 の間引き: 障害物 50 → 35（-15）。
//   中盤の反復区間のみを種別比を保って間引き、クライマックス帯（85%〜）は無改変。
//   間隔は縮めず、消えた区間の元の間隔の最大値を採って詰めた。
// 実測: 生存窓 11f / 最悪 11f / 連鎖 2 /
//   狭窓密度 0.000 / 抑制率 0.152 / 複合度 0.056 /
//   D(t) 5.09 @91.6% / タップ 23本 = 0.42/秒（構造上限 1.05）
// ---------------------------------------------------------------------------
const STAGE_8: StageDef = {
  id: 8,
  name: 'FIRST WINGS',
  speedPxPerFrame: 4.25,
  lengthPx: 13850,
  safeRunwayPx: 204,
  groundY: 148,
  objects: [
    { t: 'block', x: 374, w: 12, h: 16 },
    { t: 'pit', x: 737, w: 80 },
    { t: 'spike', x: 1287, n: 2 },
    { t: 'plat', x: 1638, y: 112 },
    // 予告マーカー（ルールB）
    { t: 'warn', x: 2042 },
    { t: 'fly', x: 2273, alt: 'MID', vx: 1 },
    { t: 'block', x: 2620, w: 12, h: 16 },
    { t: 'fly', x: 2983, alt: 'MID', vx: 1 },
    { t: 'spike', x: 3317, n: 3 },
    { t: 'fly', x: 3676, alt: 'HIGH', vx: 1 },
    { t: 'block', x: 4023, w: 24, h: 32 },
    { t: 'lift', x: 4439, y: 132, amp: 24, period: 90, phase: 0 },
    { t: 'ceil', x: 4827, w: 48, y: 96 },
    { t: 'pit', x: 5235, w: 138 },
    { t: 'spring', x: 5843 },
    { t: 'plat', x: 6202, y: 104 },
    { t: 'block', x: 6704, w: 12, h: 16 },
    { t: 'lift', x: 7108, y: 124, amp: 32, period: 100, phase: 40 },
    { t: 'fly', x: 7496, alt: 'HIGH', vx: 1 },
    { t: 'spike', x: 7830, n: 3 },
    { t: 'block', x: 8176, w: 12, h: 16 },
    { t: 'ceil', x: 8539, w: 64, y: 96 },
    { t: 'spike', x: 8975, n: 2 },
    { t: 'pit', x: 9351, w: 138 },
    { t: 'block', x: 9959, w: 24, h: 32 },
    { t: 'plat', x: 10375, y: 104 },
    { t: 'spike', x: 10877, n: 2 },
    { t: 'block', x: 11215, w: 12, h: 16 },
    { t: 'block', x: 11578, w: 24, h: 32 },
    // クライマックス帯（到達率 85〜95%）— §15-15 の間引きでも構造を保存した区間
    { t: 'fly', x: 11994, alt: 'MID', vx: 1 },
    { t: 'block', x: 12328, w: 12, h: 16 },
    { t: 'spike', x: 12591, n: 3 },
    { t: 'pit', x: 12872, w: 159 },
    { t: 'block', x: 13367, w: 12, h: 16 },
    { t: 'spike', x: 13630, n: 2 },
  ],
}

// ---------------------------------------------------------------------------
// S9 CRUMBLE — 速度 4.5 px/f / 54秒 / 14,630px
// 新規ギミック: OB-09 崩落床
// 2026-09-22 §15-15 の間引き: 障害物 82 → 43（-39）。
//   中盤の反復区間のみを種別比を保って間引き、クライマックス帯（85%〜）は無改変。
//   間隔は縮めず、消えた区間の元の間隔の最大値を採って詰めた。
// 実測: 生存窓 12f / 最悪 12f / 連鎖 2 /
//   狭窓密度 0.018 / 抑制率 0.171 / 複合度 0.043 /
//   D(t) 4.67 @91.1% / タップ 30本 = 0.55/秒（構造上限 1.05）
// ---------------------------------------------------------------------------
const STAGE_9: StageDef = {
  id: 9,
  name: 'CRUMBLE',
  speedPxPerFrame: 4.5,
  lengthPx: 14630,
  safeRunwayPx: 216,
  groundY: 148,
  objects: [
    { t: 'block', x: 396, w: 12, h: 16 },
    { t: 'spike', x: 707, n: 6 },
    { t: 'block', x: 1008, w: 24, h: 32 },
    { t: 'pit', x: 1365, w: 120 },
    // 予告マーカー（ルールB）
    { t: 'warn', x: 1885 },
    { t: 'crumble', x: 2082, y: 116, delay: 10 },
    { t: 'block', x: 2422, w: 12, h: 16 },
    { t: 'crumble', x: 2733, y: 116, delay: 10 },
    { t: 'spike', x: 3073, n: 8 },
    { t: 'fly', x: 3390, alt: 'MID', vx: 1 },
    { t: 'spike', x: 3644, n: 6 },
    { t: 'block', x: 3945, w: 12, h: 16 },
    { t: 'ceil', x: 4256, w: 48, y: 96 },
    { t: 'spike', x: 4637, n: 8 },
    { t: 'block', x: 4954, w: 12, h: 16 },
    { t: 'plat', x: 5265, y: 112 },
    { t: 'spike', x: 5613, n: 7 },
    { t: 'spring', x: 5922 },
    { t: 'fly', x: 6187, alt: 'MID', vx: 1 },
    { t: 'ceil', x: 6498, w: 48, y: 96 },
    { t: 'spike', x: 6879, n: 10 },
    { t: 'block', x: 7212, w: 12, h: 16 },
    { t: 'lift', x: 7523, y: 132, amp: 24, period: 90, phase: 30 },
    { t: 'spike', x: 7855, n: 8 },
    { t: 'spike', x: 8235, n: 10 },
    { t: 'block', x: 8648, w: 12, h: 16 },
    { t: 'spike', x: 8959, n: 13 },
    { t: 'fly', x: 9379, alt: 'MID', vx: 1 },
    { t: 'ceil', x: 9690, w: 48, y: 96 },
    { t: 'spike', x: 9980, n: 11 },
    { t: 'block', x: 10321, w: 24, h: 32 },
    { t: 'spike', x: 10678, n: 14 },
    { t: 'crumble', x: 11106, y: 108, delay: 10 },
    { t: 'spike', x: 11446, n: 12 },
    { t: 'block', x: 11795, w: 24, h: 32 },
    { t: 'spike', x: 12152, n: 13 },
    // クライマックス帯（到達率 85〜95%）— §15-15 の間引きでも構造を保存した区間
    { t: 'block', x: 12509, w: 12, h: 16 },
    { t: 'ceil', x: 12820, w: 64, y: 96 },
    { t: 'spike', x: 13128, n: 15 },
    { t: 'block', x: 13464, w: 12, h: 16 },
    { t: 'spike', x: 13743, n: 12 },
    { t: 'block', x: 14055, w: 12, h: 16 },
    { t: 'spike', x: 14334, n: 10 },
  ],
}

// ---------------------------------------------------------------------------
// S10 TEST II — 速度 5 px/f / 54秒 / 16,168px
// 新規ギミック: 章II 章末試験（新規なし）
// 2026-09-22 §15-15 の間引き: 障害物 93 → 44（-49）。
//   中盤の反復区間のみを種別比を保って間引き、クライマックス帯（85%〜）は無改変。
//   間隔は縮めず、消えた区間の元の間隔の最大値を採って詰めた。
// 実測: 生存窓 12f / 最悪 12f / 連鎖 2 /
//   狭窓密度 0.037 / 抑制率 0.140 / 複合度 0.000 /
//   D(t) 4.64 @91.1% / タップ 32本 = 0.59/秒（構造上限 1.05）
// ---------------------------------------------------------------------------
const STAGE_10: StageDef = {
  id: 10,
  name: 'TEST II',
  speedPxPerFrame: 5,
  lengthPx: 16168,
  safeRunwayPx: 240,
  groundY: 148,
  objects: [
    { t: 'block', x: 440, w: 12, h: 16 },
    { t: 'spike', x: 777, n: 8 },
    { t: 'block', x: 1116, w: 24, h: 32 },
    { t: 'pit', x: 1502, w: 140 },
    { t: 'fly', x: 2077, alt: 'MID', vx: 1 },
    { t: 'spike', x: 2345, n: 8 },
    { t: 'block', x: 2672, w: 12, h: 16 },
    { t: 'ceil', x: 3009, w: 48, y: 96 },
    { t: 'spike', x: 3313, n: 9 },
    { t: 'block', x: 3660, w: 24, h: 32 },
    { t: 'spike', x: 4046, n: 10 },
    { t: 'ceil', x: 4389, w: 48, y: 96 },
    { t: 'spike', x: 4693, n: 11 },
    { t: 'block', x: 5044, w: 12, h: 16 },
    { t: 'plat', x: 5381, y: 112 },
    { t: 'spike', x: 5756, n: 10 },
    { t: 'spring', x: 6111 },
    { t: 'fly', x: 6485, alt: 'HIGH', vx: 1 },
    { t: 'spike', x: 6760, n: 11 },
    { t: 'lift', x: 7173, y: 132, amp: 24, period: 90, phase: 20 },
    { t: 'crumble', x: 7532, y: 116, delay: 10 },
    { t: 'block', x: 7899, w: 12, h: 16 },
    { t: 'ceil', x: 8236, w: 48, y: 96 },
    { t: 'spike', x: 8646, n: 13 },
    { t: 'spike', x: 9093, n: 12 },
    { t: 'fly', x: 9551, alt: 'HIGH', vx: 1 },
    { t: 'spike', x: 9819, n: 16 },
    { t: 'ceil', x: 10210, w: 64, y: 96 },
    { t: 'spike', x: 10530, n: 13 },
    { t: 'block', x: 10897, w: 12, h: 16 },
    { t: 'spike', x: 11234, n: 14 },
    { t: 'lift', x: 11632, y: 124, amp: 32, period: 100, phase: 40 },
    { t: 'spike', x: 11991, n: 13 },
    { t: 'block', x: 12358, w: 12, h: 16 },
    { t: 'spike', x: 12695, n: 15 },
    { t: 'block', x: 13090, w: 24, h: 32 },
    { t: 'spike', x: 13476, n: 15 },
    // クライマックス帯（到達率 85〜95%）— §15-15 の間引きでも構造を保存した区間
    { t: 'block', x: 13859, w: 12, h: 16 },
    { t: 'ceil', x: 14196, w: 48, y: 96 },
    { t: 'spike', x: 14504, n: 17 },
    { t: 'block', x: 14873, w: 12, h: 16 },
    { t: 'spike', x: 15180, n: 14 },
    { t: 'block', x: 15525, w: 12, h: 16 },
    { t: 'spike', x: 15832, n: 12 },
  ],
}

/** 本幕で実装するステージ（S1〜S3）。S4〜S10 はここへ追加するだけで拡張できる */
export const STAGES: StageDef[] = [
  STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5,
  STAGE_6, STAGE_7, STAGE_8, STAGE_9, STAGE_10,
]

export function getStage(id: number): StageDef | undefined {
  return STAGES.find((s) => s.id === id)
}

export function getBudget(id: number): StageBudget | undefined {
  return STAGE_BUDGETS[id]
}
