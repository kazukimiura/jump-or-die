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
  6: { objectCount: 43, maxChain: 4, windowMinFrames: 10, windowMaxFrames: 16, climaxAt: 0.92, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25] },
  7: { objectCount: 47, maxChain: 4, windowMinFrames: 9, windowMaxFrames: 14, climaxAt: 0.89, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25] },
  8: { objectCount: 58, maxChain: 5, windowMinFrames: 8, windowMaxFrames: 12, climaxAt: 0.93, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25] },
  9: { objectCount: 72, maxChain: 5, windowMinFrames: 7, windowMaxFrames: 10, climaxAt: 0.9, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25] },
  10: { objectCount: 90, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 9, climaxAt: 0.95, climaxWarnOnly: false, tightDensity: [0.0, 0.12], suppressRatio: [0.05, 0.2], compositeRatio: [0.0, 0.25] },
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
// S4 LOW SKY — 速度 3.25 px/f / 43秒 / 8,356px
// 新規ギミック: OB-04 天井
// 実測（第2次バッチ）: 生存窓 17f / 最悪 17f / 誤帰属距離 0 /
//   連鎖 2 / 狭窓密度 0.000 / 抑制率 0.100 / 複合度 0.000 /
//   D(t) 3.64 @89.2% / クリア 2554f
// ---------------------------------------------------------------------------
const STAGE_4: StageDef = {
  id: 4,
  name: 'LOW SKY',
  speedPxPerFrame: 3.25,
  lengthPx: 8356,
  safeRunwayPx: 156,
  groundY: 148,
  objects: [
    { t: 'block', x: 286, w: 12, h: 16 },
    { t: 'block', x: 501, w: 24, h: 32 },
    { t: 'pit', x: 768, w: 48 },
    { t: 'spike', x: 1073, n: 2 },
    { t: 'warn', x: 1240 },
    { t: 'ceil', x: 1370, w: 48, y: 96 },
    { t: 'block', x: 1621, w: 12, h: 16 },
    { t: 'ceil', x: 1849, w: 48, y: 96 },
    { t: 'pit', x: 2140, w: 56 },
    { t: 'spike', x: 2453, n: 3 },
    { t: 'block', x: 2693, w: 24, h: 32 },
    { t: 'ceil', x: 2947, w: 64, y: 96 },
    { t: 'block', x: 3214, w: 12, h: 16 },
    { t: 'pit', x: 3456, w: 56 },
    { t: 'block', x: 3769, w: 12, h: 16 },
    { t: 'spike', x: 4011, n: 2 },
    { t: 'block', x: 4257, w: 12, h: 16 },
    { t: 'block', x: 4499, w: 24, h: 32 },
    { t: 'spike', x: 4753, n: 2 },
    { t: 'pit', x: 4999, w: 56 },
    { t: 'block', x: 5312, w: 12, h: 16 },
    { t: 'spike', x: 5554, n: 2 },
    { t: 'block', x: 5800, w: 12, h: 16 },
    { t: 'block', x: 6042, w: 24, h: 32 },
    { t: 'spike', x: 6296, n: 2 },
    { t: 'block', x: 6542, w: 12, h: 16 },
    { t: 'spike', x: 6784, n: 3 },
    { t: 'block', x: 7038, w: 12, h: 16 },
    { t: 'pit', x: 7307, w: 104 },
    { t: 'block', x: 7668, w: 12, h: 16 },
    { t: 'spike', x: 7872, n: 3 },
  ],
}

// ---------------------------------------------------------------------------
// S5 TEST I — 速度 3.5 px/f / 48秒 / 10,169px
// 新規ギミック: 章I 章末試験（新規なし）
// 実測（第2次バッチ）: 生存窓 14f / 最悪 14f / 誤帰属距離 0 /
//   連鎖 2 / 狭窓密度 0.000 / 抑制率 0.086 / 複合度 0.000 /
//   D(t) 4.24 @86.4% / クリア 2890f
// ---------------------------------------------------------------------------
const STAGE_5: StageDef = {
  id: 5,
  name: 'TEST I',
  speedPxPerFrame: 3.5,
  lengthPx: 10169,
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
    { t: 'block', x: 2779, w: 24, h: 32 },
    { t: 'spike', x: 3034, n: 2 },
    { t: 'block', x: 3276, w: 12, h: 16 },
    { t: 'ceil', x: 3536, w: 64, y: 96 },
    { t: 'block', x: 3834, w: 12, h: 16 },
    { t: 'pit', x: 4080, w: 84 },
    { t: 'spike', x: 4441, n: 3 },
    { t: 'block', x: 4691, w: 12, h: 16 },
    { t: 'block', x: 4937, w: 24, h: 32 },
    { t: 'spike', x: 5192, n: 2 },
    { t: 'pit', x: 5442, w: 96 },
    { t: 'block', x: 5815, w: 12, h: 16 },
    { t: 'spike', x: 6053, n: 3 },
    { t: 'ceil', x: 6311, w: 48, y: 96 },
    { t: 'block', x: 6585, w: 12, h: 16 },
    { t: 'block', x: 6831, w: 24, h: 32 },
    { t: 'spike', x: 7086, n: 2 },
    { t: 'pit', x: 7336, w: 104 },
    { t: 'block', x: 7717, w: 12, h: 16 },
    { t: 'spike', x: 7955, n: 3 },
    { t: 'block', x: 8205, w: 12, h: 16 },
    { t: 'block', x: 8451, w: 24, h: 32 },
    { t: 'spike', x: 8706, n: 2 },
    { t: 'pit', x: 8970, w: 120 },
    { t: 'block', x: 9367, w: 12, h: 16 },
    { t: 'spike', x: 9586, n: 3 },
  ],
}

// ---------------------------------------------------------------------------
// S6 FLOATING — 速度 3.75 px/f / 80秒 / 17,983px
// 新規ギミック: OB-05 浮遊足場
// 実測（第2次バッチ）: 生存窓 11f / 最悪 11f / 誤帰属距離 0 /
//   連鎖 4 / 狭窓密度 0.000 / 抑制率 0.143 / 複合度 0.000 /
//   D(t) 5.13 @89.5% / クリア 4781f
// ---------------------------------------------------------------------------
const STAGE_6: StageDef = {
  id: 6,
  name: 'FLOATING',
  speedPxPerFrame: 3.75,
  lengthPx: 17983,
  safeRunwayPx: 180,
  groundY: 148,
  objects: [
    { t: 'block', x: 330, w: 12, h: 16 },
    { t: 'pit', x: 693, w: 64 },
    { t: 'spike', x: 1201, n: 2 },
    { t: 'block', x: 1568, w: 24, h: 32 },
    { t: 'warn', x: 1961 },
    { t: 'plat', x: 2179, y: 112 },
    { t: 'block', x: 2562, w: 12, h: 16 },
    { t: 'plat', x: 2925, y: 112 },
    { t: 'spike', x: 3308, n: 3 },
    { t: 'plat', x: 3683, y: 104 },
    { t: 'block', x: 4066, w: 12, h: 16 },
    { t: 'ceil', x: 4429, w: 48, y: 96 },
    { t: 'ceil', x: 5016, w: 48, y: 96 },
    { t: 'pit', x: 5439, w: 121 },
    { t: 'block', x: 6004, w: 12, h: 16 },
    { t: 'plat', x: 6367, y: 104 },
    { t: 'spike', x: 6750, n: 2 },
    { t: 'block', x: 7117, w: 24, h: 32 },
    { t: 'ceil', x: 7510, w: 64, y: 96 },
    { t: 'ceil', x: 8113, w: 48, y: 96 },
    { t: 'block', x: 8512, w: 12, h: 16 },
    { t: 'pit', x: 8899, w: 121 },
    { t: 'plat', x: 9464, y: 96 },
    { t: 'spike', x: 9847, n: 3 },
    { t: 'block', x: 10210, w: 12, h: 16 },
    { t: 'block', x: 10573, w: 24, h: 32 },
    { t: 'spike', x: 10966, n: 2 },
    { t: 'plat', x: 11333, y: 104 },
    { t: 'ceil', x: 11716, w: 48, y: 96 },
    { t: 'ceil', x: 12303, w: 48, y: 96 },
    { t: 'block', x: 12702, w: 12, h: 16 },
    { t: 'pit', x: 13089, w: 121 },
    { t: 'spike', x: 13654, n: 3 },
    { t: 'block', x: 14017, w: 12, h: 16 },
    { t: 'block', x: 14380, w: 24, h: 32 },
    { t: 'plat', x: 14773, y: 112 },
    { t: 'spike', x: 15156, n: 2 },
    { t: 'block', x: 15511, w: 12, h: 16 },
    { t: 'pit', x: 15898, w: 140 },
    { t: 'spike', x: 16334, n: 3 },
    { t: 'block', x: 16545, w: 12, h: 16 },
    { t: 'spike', x: 16779, n: 2 },
    { t: 'block', x: 16982, w: 12, h: 16 },
  ],
}

// ---------------------------------------------------------------------------
// S7 THE LIFT — 速度 4 px/f / 79秒 / 18,879px
// 新規ギミック: OB-07 昇降 / OB-10 バネ
// 実測（第2次バッチ）: 生存窓 11f / 最悪 11f / 誤帰属距離 0 /
//   連鎖 2 / 狭窓密度 0.000 / 抑制率 0.116 / 複合度 0.058 /
//   D(t) 5.32 @89.5% / クリア 4706f
// ---------------------------------------------------------------------------
const STAGE_7: StageDef = {
  id: 7,
  name: 'THE LIFT',
  speedPxPerFrame: 4,
  lengthPx: 18879,
  safeRunwayPx: 192,
  groundY: 148,
  objects: [
    { t: 'block', x: 352, w: 12, h: 16 },
    { t: 'pit', x: 684, w: 72 },
    { t: 'spike', x: 1184, n: 2 },
    { t: 'plat', x: 1516, y: 112 },
    { t: 'warn', x: 1887 },
    { t: 'lift', x: 2098, y: 132, amp: 24, period: 90, phase: 0 },
    { t: 'block', x: 2453, w: 12, h: 16 },
    { t: 'lift', x: 2785, y: 132, amp: 24, period: 90, phase: 30 },
    { t: 'spike', x: 3140, n: 3 },
    { t: 'warn', x: 3416 },
    { t: 'spring', x: 3627 },
    { t: 'block', x: 3978, w: 12, h: 16 },
    { t: 'spring', x: 4310 },
    { t: 'ceil', x: 4661, w: 48, y: 96 },
    { t: 'ceil', x: 5183, w: 48, y: 96 },
    { t: 'block', x: 5547, w: 24, h: 32 },
    { t: 'lift', x: 5927, y: 124, amp: 32, period: 100, phase: 0 },
    { t: 'ceil', x: 6282, w: 48, y: 96 },
    { t: 'lift', x: 6646, y: 124, amp: 32, period: 100, phase: 50 },
    { t: 'block', x: 7001, w: 12, h: 16 },
    { t: 'pit', x: 7352, w: 130 },
    { t: 'plat', x: 7910, y: 104 },
    { t: 'spike', x: 8281, n: 2 },
    { t: 'spring', x: 8613 },
    { t: 'block', x: 8941, w: 12, h: 16 },
    { t: 'ceil', x: 9280, w: 64, y: 96 },
    { t: 'lift', x: 9660, y: 132, amp: 24, period: 80, phase: 20 },
    { t: 'spike', x: 10015, n: 3 },
    { t: 'block', x: 10343, w: 12, h: 16 },
    { t: 'pit', x: 10694, w: 130 },
    { t: 'block', x: 11252, w: 24, h: 32 },
    { t: 'spike', x: 11632, n: 2 },
    { t: 'plat', x: 11964, y: 112 },
    { t: 'block', x: 12335, w: 12, h: 16 },
    { t: 'ceil', x: 12674, w: 48, y: 96 },
    { t: 'lift', x: 13038, y: 124, amp: 32, period: 90, phase: 40 },
    { t: 'pit', x: 13393, w: 130 },
    { t: 'spike', x: 13951, n: 3 },
    { t: 'block', x: 14279, w: 12, h: 16 },
    { t: 'block', x: 14611, w: 24, h: 32 },
    { t: 'spring', x: 14991 },
    { t: 'block', x: 15319, w: 12, h: 16 },
    { t: 'spike', x: 15651, n: 2 },
    { t: 'pit', x: 16006, w: 130 },
    { t: 'block', x: 16564, w: 12, h: 16 },
    { t: 'block', x: 16813, w: 24, h: 32 },
    { t: 'pit', x: 17101, w: 150 },
    { t: 'block', x: 17568, w: 12, h: 16 },
    { t: 'spike', x: 17817, n: 3 },
  ],
}

// ---------------------------------------------------------------------------
// S8 FIRST WINGS — 速度 4.25 px/f / 80秒 / 20,504px
// 新規ギミック: OB-08 飛行体（vx=1.0）
// 実測（第2次バッチ）: 生存窓 11f / 最悪 11f / 誤帰属距離 0 /
//   連鎖 2 / 狭窓密度 0.000 / 抑制率 0.191 / 複合度 0.074 /
//   D(t) 5.09 @89.9% / クリア 4812f
// ---------------------------------------------------------------------------
const STAGE_8: StageDef = {
  id: 8,
  name: 'FIRST WINGS',
  speedPxPerFrame: 4.25,
  lengthPx: 20504,
  safeRunwayPx: 204,
  groundY: 148,
  objects: [
    { t: 'block', x: 374, w: 12, h: 16 },
    { t: 'pit', x: 737, w: 80 },
    { t: 'spike', x: 1287, n: 2 },
    { t: 'plat', x: 1638, y: 112 },
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
    { t: 'block', x: 5843, w: 12, h: 16 },
    { t: 'spring', x: 6206 },
    { t: 'fly', x: 6553, alt: 'MID', vx: 1 },
    { t: 'ceil', x: 6912, w: 48, y: 96 },
    { t: 'spike', x: 7282, n: 2 },
    { t: 'plat', x: 7633, y: 104 },
    { t: 'pit', x: 8037, w: 138 },
    { t: 'block', x: 8645, w: 12, h: 16 },
    { t: 'block', x: 9008, w: 24, h: 32 },
    { t: 'lift', x: 9424, y: 124, amp: 32, period: 100, phase: 40 },
    { t: 'fly', x: 9812, alt: 'HIGH', vx: 1 },
    { t: 'spike', x: 10146, n: 3 },
    { t: 'block', x: 10492, w: 12, h: 16 },
    { t: 'ceil', x: 10855, w: 64, y: 96 },
    { t: 'plat', x: 11254, y: 112 },
    { t: 'spike', x: 11658, n: 2 },
    { t: 'pit', x: 12034, w: 138 },
    { t: 'spring', x: 12642 },
    { t: 'block', x: 12989, w: 12, h: 16 },
    { t: 'fly', x: 13352, alt: 'MID', vx: 1 },
    { t: 'block', x: 13699, w: 24, h: 32 },
    { t: 'spike', x: 14115, n: 3 },
    { t: 'block', x: 14461, w: 12, h: 16 },
    { t: 'lift', x: 14824, y: 132, amp: 24, period: 80, phase: 20 },
    { t: 'ceil', x: 15212, w: 48, y: 96 },
    { t: 'plat', x: 15595, y: 104 },
    { t: 'pit', x: 15999, w: 138 },
    { t: 'spike', x: 16607, n: 2 },
    { t: 'block', x: 16945, w: 12, h: 16 },
    { t: 'block', x: 17308, w: 24, h: 32 },
    { t: 'fly', x: 17724, alt: 'MID', vx: 1 },
    { t: 'block', x: 18058, w: 12, h: 16 },
    { t: 'spike', x: 18321, n: 3 },
    { t: 'pit', x: 18602, w: 159 },
    { t: 'block', x: 19097, w: 12, h: 16 },
    { t: 'spike', x: 19360, n: 2 },
  ],
}

/** 本幕で実装するステージ（S1〜S3）。S4〜S10 はここへ追加するだけで拡張できる */
export const STAGES: StageDef[] = [STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, STAGE_6, STAGE_7, STAGE_8]

export function getStage(id: number): StageDef | undefined {
  return STAGES.find((s) => s.id === id)
}

export function getBudget(id: number): StageBudget | undefined {
  return STAGE_BUDGETS[id]
}
