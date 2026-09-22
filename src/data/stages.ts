/**
 * JumpOrDie — ステージデータ（GDD §16「全面再較正」に基づく全面作り直し・2026-09-22）
 *
 * 【この作り直しの根拠】
 * 社長が旧10本を**一度も死なずにクリア**した。原因は生存窓の最小値だけを規定し、
 * 通しクリア確率 `P = Π(1-p_i)` を一度も計算しなかったことによる。σ=40ms で
 * 旧設計を計算し直すと 10本合計の期待死亡回数は約0.5回で、**実測0回は設計どおり**だった。
 *
 * 【本データの設計原理】
 *  - 難易度カーブを作るのは**窓ではなく狭窓の本数**。窓は 6〜9f でほぼ一定に保つ。
 *  - 各ステージの `E[D_skill]` を目標死亡回数の帯に入れる（不合格条件・§16-7）。
 *  - **1ステージ = 1新要素、S1 から投入**（§16-5）。章＝ギミック導入の単位という扱いは破棄。
 *
 * 【誤帰属0 が使えるユニットを限定した】
 * 実測の結果、次の形は**構造的に誤帰属1以上を生む**ので一切使っていない:
 *   - ブロックの階段（踏み外して落ちる間に他のブロックを「突破」する）
 *   - 天井 → 槍 の密接した複合（天井をくぐった後に槍で死ぬ）
 *   - **踏み台を離した WALL**（踏み台に乗った後に WALL で死ぬ）
 * WALL は**踏み台を密着させれば誤帰属0**になる（実測）。本データはすべてその形。
 */
import type { StageBudget, StageDef } from '@/lib/game/types'

/**
 * 検査基準（GDD §6-3 / §16-2）。
 * `tightDensity` は章の表（CHAPTER_TIGHT_DENSITY）で判定するのでここでは参考値。
 * `objectCount` / `tapsPerSecond` は**実測の記録**であって設計値ではない（§15-16）。
 */
export const STAGE_BUDGETS: Record<number, StageBudget> = {
  1: { objectCount: 19, maxChain: 3, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.85, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.25], compositeRatio: [0, 0.35], tapsPerSecond: 0.66, deathTarget: 5 },
  2: { objectCount: 22, maxChain: 3, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.86, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.25], compositeRatio: [0, 0.35], tapsPerSecond: 0.62, deathTarget: 8 },
  3: { objectCount: 22, maxChain: 3, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.86, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.25], compositeRatio: [0, 0.6], tapsPerSecond: 0.64, deathTarget: 12 },
  4: { objectCount: 26, maxChain: 4, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.87, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.3], compositeRatio: [0, 0.7], tapsPerSecond: 0.59, deathTarget: 18 },
  5: { objectCount: 29, maxChain: 5, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.87, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.3], compositeRatio: [0, 0.85], tapsPerSecond: 0.70, deathTarget: 25 },
  6: { objectCount: 26, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.87, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.3], compositeRatio: [0, 0.7], tapsPerSecond: 0.50, deathTarget: 35 },
  7: { objectCount: 29, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.91, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.3], compositeRatio: [0, 0.7], tapsPerSecond: 0.52, deathTarget: 45 },
  8: { objectCount: 30, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.88, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.35], compositeRatio: [0, 0.8], tapsPerSecond: 0.59, deathTarget: 60 },
  9: { objectCount: 33, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.92, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.35], compositeRatio: [0, 0.8], tapsPerSecond: 0.59, deathTarget: 80 },
  10: { objectCount: 33, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.85, climaxWarnOnly: false, tightDensity: [0, 1], suppressRatio: [0, 0.35], compositeRatio: [0, 0.95], tapsPerSecond: 0.57, deathTarget: 110 },
}

// ---------------------------------------------------------------------------
// S1 FIRST STEP — 速度 3 px/f / 29秒 / 5,218px
// 新要素: `block` — 跳ぶという操作そのもの
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.448 / 抑制率 0.000 / 複合度 0.292 /
//   D(t) 12.00 @85.4% / タップ 19本 = 0.66/秒 / クリア 1721f
//   **E[D_skill] = 4.2（目標 5）** [σ=30: 0.7 / σ=40: 4.2 / σ=50: 20.8] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_1: StageDef = {
  id: 1,
  name: 'FIRST STEP',
  speedPxPerFrame: 3,
  lengthPx: 5218,
  safeRunwayPx: 144,
  groundY: 148,
  objects: [
    { t: 'block', x: 244, w: 24, h: 16 },
    { t: 'block', x: 531, w: 24, h: 16 },
    { t: 'spear', x: 818, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1087, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1356, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1625, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1894, h: 51, triggerX: -1, rise: 8 },
    { t: 'block', x: 2163, w: 24, h: 32 },
    { t: 'spear', x: 2450, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2719, h: 51, triggerX: -1, rise: 8 },
    { t: 'block', x: 2988, w: 24, h: 16 },
    { t: 'spear', x: 3275, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3544, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3813, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4082, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4351, h: 51, triggerX: -1, rise: 8 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spear', x: 4528, h: 51, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 4705 },
    { t: 'block', x: 4884, w: 24, h: 32 },
    { t: 'block', x: 5079, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [20, 55], [116, 151], [228, 235], [318, 324], [407, 414], [497, 504], [587, 593], [664, 691],
    [772, 779], [862, 868], [935, 970], [1047, 1054], [1137, 1143], [1226, 1233], [1316, 1323], [1406, 1412],
    [1465, 1471], [1571, 1598], [1636, 1663],
  ],
}

// ---------------------------------------------------------------------------
// S2 GAP — 速度 3.1 px/f / 35秒 / 6,600px
// 新要素: `pit` — 落ちたら死ぬ地形
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 1 / 誤帰属 0 /
//   狭窓密度 0.479 / 抑制率 0.000 / 複合度 0.308 /
//   D(t) 12.00 @85.6% / タップ 22本 = 0.62/秒 / クリア 2111f
//   **E[D_skill] = 8.1（目標 8）** [σ=30: 1.0 / σ=40: 8.1 / σ=50: 60.7] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_2: StageDef = {
  id: 2,
  name: 'GAP',
  speedPxPerFrame: 3.1,
  lengthPx: 6600,
  safeRunwayPx: 149,
  groundY: 148,
  objects: [
    { t: 'block', x: 252, w: 24, h: 16 },
    { t: 'pit', x: 560, w: 56 },
    { t: 'spear', x: 900, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1190, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1480, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1770, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2060, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2350, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2640, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2930, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3220, h: 51, triggerX: -1, rise: 8 },
    { t: 'pit', x: 3510, w: 80 },
    { t: 'spear', x: 3874, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4164, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4454, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4744, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5034, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5324, h: 51, triggerX: -1, rise: 8 },
    { t: 'spike', x: 5500, n: 12 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spike', x: 5766, n: 12 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6032 },
    { t: 'pit', x: 6210, w: 96 },
    { t: 'block', x: 6476, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [21, 56], [134, 164], [246, 253], [340, 346], [433, 440], [527, 534], [621, 627], [714, 721],
    [808, 814], [901, 908], [995, 1001], [1093, 1116], [1206, 1212], [1299, 1306], [1393, 1399], [1486, 1493],
    [1580, 1586], [1673, 1680], [1745, 1751], [1831, 1837], [1969, 1987], [2032, 2060],
  ],
}

// ---------------------------------------------------------------------------
// S3 THORN — 速度 3.5 px/f / 34秒 / 7,188px
// 新要素: `spear` 静止 — 高くて上に乗れない障害物
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.526 / 抑制率 0.000 / 複合度 0.396 /
//   D(t) 12.00 @86.5% / タップ 22本 = 0.64/秒 / クリア 2038f
//   **E[D_skill] = 13.0（目標 12）** [σ=30: 1.4 / σ=40: 13.0 / σ=50: 127.6] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_3: StageDef = {
  id: 3,
  name: 'THORN',
  speedPxPerFrame: 3.5,
  lengthPx: 7188,
  safeRunwayPx: 168,
  groundY: 148,
  objects: [
    { t: 'block', x: 285, w: 24, h: 16 },
    { t: 'spear', x: 630, h: 48, triggerX: -1, rise: 8 },
    { t: 'spear', x: 957, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1284, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1611, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1938, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2265, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2592, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2919, h: 50, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3246, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3573, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3900, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4227, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4554, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4881, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5208, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5535, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5862, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 6093, h: 52, triggerX: -1, rise: 8 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spear', x: 6324, h: 52, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6555 },
    { t: 'spear', x: 6788, h: 52, triggerX: -1, rise: 8 },
    { t: 'block', x: 7019, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [23, 59], [136, 147], [232, 239], [326, 332], [419, 425], [513, 519], [606, 612], [700, 706],
    [791, 800], [886, 893], [980, 986], [1073, 1079], [1167, 1173], [1260, 1266], [1354, 1360], [1447, 1453],
    [1540, 1547], [1634, 1640], [1700, 1706], [1766, 1772], [1898, 1905], [1951, 1979],
  ],
}

// ---------------------------------------------------------------------------
// S4 LOW SKY — 速度 3.75 px/f / 37秒 / 8,411px
// 新要素: `ceil` — 跳ばないという判断
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 1 / 誤帰属 0 /
//   狭窓密度 0.535 / 抑制率 0.154 / 複合度 0.437 /
//   D(t) 12.00 @87.0% / タップ 22本 = 0.59/秒 / クリア 2228f
//   **E[D_skill] = 18.3（目標 18）** [σ=30: 1.7 / σ=40: 18.3 / σ=50: 208.5] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_4: StageDef = {
  id: 4,
  name: 'LOW SKY',
  speedPxPerFrame: 3.75,
  lengthPx: 8411,
  safeRunwayPx: 180,
  groundY: 148,
  objects: [
    { t: 'block', x: 305, w: 24, h: 16 },
    { t: 'ceil', x: 642, w: 48, y: 96 },
    { t: 'spear', x: 1003, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1322, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1641, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1960, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2279, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2598, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2917, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 3236, w: 48, y: 88 },
    { t: 'spear', x: 3597, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3916, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4235, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 4554, w: 48, y: 96 },
    { t: 'spear', x: 4915, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5234, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5553, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5872, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 6191, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 6510, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 6735, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 6960, h: 52, triggerX: -1, rise: 8 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spear', x: 7185, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 7410, h: 52, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 7635 },
    { t: 'ceil', x: 7862, w: 48, y: 104 },
    { t: 'block', x: 8129, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [24, 60], [228, 234], [313, 319], [398, 404], [483, 489], [568, 574], [653, 659], [738, 744],
    [919, 926], [1004, 1011], [1089, 1096], [1271, 1277], [1356, 1362], [1441, 1447], [1526, 1532], [1611, 1617],
    [1696, 1702], [1756, 1762], [1816, 1822], [1876, 1882], [1936, 1942], [2115, 2142],
  ],
}

// ---------------------------------------------------------------------------
// S5 PENDULUM — 速度 4 px/f / 40秒 / 9,554px
// 新要素: `swing`（G1 障害物が動く）＋ 章末試験
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 1 / 誤帰属 0 /
//   狭窓密度 0.553 / 抑制率 0.034 / 複合度 0.363 /
//   D(t) 12.00 @86.9% / タップ 28本 = 0.70/秒 / クリア 2375f
//   **E[D_skill] = 17.9（目標 25）** [σ=30: 1.5 / σ=40: 17.9 / σ=50: 228.9] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_5: StageDef = {
  id: 5,
  name: 'PENDULUM',
  speedPxPerFrame: 4,
  lengthPx: 9554,
  safeRunwayPx: 192,
  groundY: 148,
  objects: [
    { t: 'block', x: 325, w: 24, h: 16 },
    { t: 'swing', x: 649, y: 132, amp: 16, period: 90, phase: 0 },
    { t: 'spear', x: 981, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1287, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1593, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 1899, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2205, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 2511, h: 52, triggerX: -1, rise: 8 },
    { t: 'swing', x: 2817, y: 132, amp: 24, period: 90, phase: 0 },
    { t: 'spear', x: 3157, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3463, h: 52, triggerX: -1, rise: 8 },
    { t: 'swing', x: 3769, y: 132, amp: 32, period: 90, phase: 0 },
    { t: 'spear', x: 4117, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4423, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4729, h: 52, triggerX: -1, rise: 8 },
    { t: 'swing', x: 5035, y: 132, amp: 24, period: 90, phase: 0 },
    { t: 'spear', x: 5375, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5681, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5987, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 6293, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 6599, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 6905, h: 52, triggerX: -1, rise: 8 },
    { t: 'spear', x: 7211, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 7427, n: 16 },
    { t: 'spike', x: 7765, n: 16 },
    { t: 'spike', x: 8103, n: 16 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spike', x: 8441, n: 16 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 8779 },
    { t: 'ceil', x: 8997, w: 48, y: 96 },
    { t: 'block', x: 9255, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [26, 61], [109, 145], [206, 213], [283, 289], [359, 366], [436, 442], [512, 519], [589, 595],
    [652, 688], [750, 757], [827, 833], [892, 927], [990, 997], [1067, 1073], [1143, 1150], [1205, 1241],
    [1305, 1311], [1381, 1388], [1458, 1464], [1534, 1541], [1611, 1617], [1687, 1694], [1764, 1770], [1833, 1839],
    [1917, 1923], [2002, 2008], [2086, 2092], [2262, 2289],
  ],
}

// ---------------------------------------------------------------------------
// S6 THE WALL — 速度 4.25 px/f / 48秒 / 12,268px
// 新要素: WALL + 踏み台（G2 踏み台必須）＋ `plat`
// 実測: 生存窓 6f（最悪 1f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.457 / 抑制率 0.000 / 複合度 0.000 /
//   D(t) 13.00 @87.0% / タップ 24本 = 0.50/秒 / クリア 2874f
//   **E[D_skill] = 38.2（目標 35）** [σ=30: 2.8 / σ=40: 38.2 / σ=50: 621.5] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_6: StageDef = {
  id: 6,
  name: 'THE WALL',
  speedPxPerFrame: 4.25,
  lengthPx: 12268,
  safeRunwayPx: 204,
  groundY: 148,
  objects: [
    { t: 'block', x: 346, w: 24, h: 16 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 1149 },
    { t: 'block', x: 1237, w: 48, h: 32 },
    { t: 'block', x: 1293, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 2096 },
    { t: 'block', x: 2184, w: 48, h: 32 },
    { t: 'block', x: 2240, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3043 },
    { t: 'block', x: 3131, w: 48, h: 32 },
    { t: 'block', x: 3187, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3990 },
    { t: 'block', x: 4078, w: 48, h: 32 },
    { t: 'block', x: 4134, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 4937 },
    { t: 'block', x: 5025, w: 48, h: 32 },
    { t: 'block', x: 5081, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 5884 },
    { t: 'block', x: 5972, w: 48, h: 32 },
    { t: 'block', x: 6028, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6831 },
    { t: 'block', x: 6919, w: 48, h: 32 },
    { t: 'block', x: 6975, w: 24, h: 64 },
    { t: 'plat', x: 7778, y: 108 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 8589 },
    { t: 'block', x: 8677, w: 48, h: 32 },
    { t: 'block', x: 8733, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 9536 },
    { t: 'block', x: 9624, w: 48, h: 32 },
    { t: 'block', x: 9680, w: 24, h: 64 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10483 },
    { t: 'block', x: 10571, w: 48, h: 32 },
    { t: 'block', x: 10627, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 11430 },
    { t: 'block', x: 11518, w: 48, h: 32 },
    { t: 'block', x: 11574, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 11871 },
    { t: 'plat', x: 12152, y: 100 },
    { t: 'block', x: 12457, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [27, 62], [240, 247], [275, 281], [463, 470], [498, 504], [686, 692], [721, 726], [909, 915],
    [944, 949], [1132, 1138], [1167, 1172], [1354, 1361], [1389, 1395], [1577, 1584], [1612, 1618], [1782, 1792],
    [1991, 1997], [2026, 2031], [2214, 2220], [2249, 2254], [2437, 2443], [2472, 2477], [2659, 2666], [2694, 2700],
  ],
}

// ---------------------------------------------------------------------------
// S7 VERMIN — 速度 4.5 px/f / 52秒 / 14,144px
// 新要素: `mouse`（G3 正面から飛んでくる）
// 実測: 生存窓 6f（最悪 1f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.420 / 抑制率 0.000 / 複合度 0.000 /
//   D(t) 19.00 @90.7% / タップ 27本 = 0.52/秒 / クリア 3131f
//   **E[D_skill] = 37.3（目標 45）** [σ=30: 2.7 / σ=40: 37.3 / σ=50: 580.0] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_7: StageDef = {
  id: 7,
  name: 'VERMIN',
  speedPxPerFrame: 4.5,
  lengthPx: 14144,
  safeRunwayPx: 216,
  groundY: 148,
  objects: [
    { t: 'block', x: 366, w: 24, h: 16 },
    { t: 'fly', x: 1140, alt: 'LOW', vx: 2, amp: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 1902 },
    { t: 'block', x: 1990, w: 52, h: 32 },
    { t: 'block', x: 2050, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 2824 },
    { t: 'block', x: 2912, w: 52, h: 32 },
    { t: 'block', x: 2972, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3746 },
    { t: 'block', x: 3834, w: 52, h: 32 },
    { t: 'block', x: 3894, w: 24, h: 64 },
    { t: 'fly', x: 4668, alt: 'LOW', vx: 3, amp: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 5430 },
    { t: 'block', x: 5518, w: 52, h: 32 },
    { t: 'block', x: 5578, w: 24, h: 64 },
    { t: 'fly', x: 6352, alt: 'LOW', vx: 2.5, amp: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 7114 },
    { t: 'block', x: 7202, w: 52, h: 32 },
    { t: 'block', x: 7262, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 8036 },
    { t: 'block', x: 8124, w: 52, h: 32 },
    { t: 'block', x: 8184, w: 24, h: 64 },
    { t: 'fly', x: 8958, alt: 'LOW', vx: 3.5, amp: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 9720 },
    { t: 'block', x: 9808, w: 52, h: 32 },
    { t: 'block', x: 9868, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10642 },
    { t: 'block', x: 10730, w: 52, h: 32 },
    { t: 'block', x: 10790, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 11564 },
    { t: 'block', x: 11652, w: 52, h: 32 },
    { t: 'block', x: 11712, w: 24, h: 64 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 12486 },
    { t: 'block', x: 12574, w: 52, h: 32 },
    { t: 'block', x: 12634, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 12996 },
    { t: 'block', x: 13084, w: 52, h: 32 },
    { t: 'block', x: 13144, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 13506 },
    { t: 'plat', x: 13852, y: 108 },
    { t: 'block', x: 14222, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [28, 63], [185, 220], [392, 399], [427, 433], [597, 604], [632, 638], [802, 809], [837, 843],
    [963, 999], [1176, 1183], [1211, 1217], [1340, 1375], [1551, 1557], [1586, 1591], [1756, 1762], [1791, 1796],
    [1914, 1950], [2130, 2136], [2165, 2170], [2335, 2341], [2370, 2375], [2540, 2546], [2575, 2580], [2744, 2751],
    [2779, 2785], [2858, 2864], [2893, 2898],
  ],
}

// ---------------------------------------------------------------------------
// S8 FALLOUT — 速度 4.75 px/f / 47秒 / 13,513px
// 新要素: `drop`（G5 浮遊オブジェクトの落下）
// 実測: 生存窓 6f（最悪 1f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.485 / 抑制率 0.067 / 複合度 0.000 /
//   D(t) 14.00 @88.0% / タップ 28本 = 0.59/秒 / クリア 2834f
//   **E[D_skill] = 47.6（目標 60）** [σ=30: 3.1 / σ=40: 47.6 / σ=50: 850.0] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_8: StageDef = {
  id: 8,
  name: 'FALLOUT',
  speedPxPerFrame: 4.75,
  lengthPx: 13513,
  safeRunwayPx: 228,
  groundY: 148,
  objects: [
    { t: 'block', x: 386, w: 24, h: 16 },
    { t: 'drop', x: 1004, y: 108, triggerX: -1, falls: false },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 1614 },
    { t: 'block', x: 1702, w: 56, h: 32 },
    { t: 'block', x: 1766, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 2384 },
    { t: 'block', x: 2472, w: 56, h: 32 },
    { t: 'block', x: 2536, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3154 },
    { t: 'block', x: 3242, w: 56, h: 32 },
    { t: 'block', x: 3306, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3924 },
    { t: 'block', x: 4012, w: 56, h: 32 },
    { t: 'block', x: 4076, w: 24, h: 64 },
    { t: 'drop', x: 4694, y: 108, triggerX: 4394, falls: true, tell: true },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 5304 },
    { t: 'block', x: 5392, w: 56, h: 32 },
    { t: 'block', x: 5456, w: 24, h: 64 },
    { t: 'drop', x: 6074, y: 100, triggerX: -1, falls: false },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6684 },
    { t: 'block', x: 6772, w: 56, h: 32 },
    { t: 'block', x: 6836, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 7454 },
    { t: 'block', x: 7542, w: 56, h: 32 },
    { t: 'block', x: 7606, w: 24, h: 64 },
    { t: 'drop', x: 8224, y: 108, triggerX: 7824, falls: true, tell: true },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 8834 },
    { t: 'block', x: 8922, w: 56, h: 32 },
    { t: 'block', x: 8986, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 9604 },
    { t: 'block', x: 9692, w: 56, h: 32 },
    { t: 'block', x: 9756, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10374 },
    { t: 'block', x: 10462, w: 56, h: 32 },
    { t: 'block', x: 10526, w: 24, h: 64 },
    { t: 'spike', x: 11144, n: 19 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spike', x: 11652, n: 19 },
    { t: 'spike', x: 12160, n: 19 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 12668 },
    { t: 'fly', x: 13032, alt: 'LOW', vx: 3, amp: 0 },
    { t: 'block', x: 13400, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [28, 63], [309, 316], [344, 350], [471, 478], [506, 512], [634, 640], [669, 674], [796, 802],
    [831, 836], [940, 970], [1086, 1093], [1121, 1127], [1377, 1383], [1412, 1417], [1539, 1545], [1574, 1579],
    [1684, 1714], [1829, 1836], [1864, 1870], [1991, 1998], [2026, 2032], [2154, 2160], [2189, 2194], [2325, 2331],
    [2432, 2437], [2539, 2544], [2672, 2708], [2772, 2799],
  ],
}

// ---------------------------------------------------------------------------
// S9 WINGBEAT — 速度 5 px/f / 54秒 / 16,313px
// 新要素: `fly` 上下動（G6）＋ `lift` / `spring`
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 1 / 誤帰属 0 /
//   狭窓密度 0.478 / 抑制率 0.000 / 複合度 0.000 /
//   D(t) 12.00 @92.4% / タップ 32本 = 0.59/秒 / クリア 3252f
//   **E[D_skill] = 57.3（目標 80）** [σ=30: 3.0 / σ=40: 57.3 / σ=50: 1407.2] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_9: StageDef = {
  id: 9,
  name: 'WINGBEAT',
  speedPxPerFrame: 5,
  lengthPx: 16313,
  safeRunwayPx: 240,
  groundY: 148,
  objects: [
    { t: 'block', x: 407, w: 24, h: 16 },
    { t: 'fly', x: 827, alt: 'LOW', vx: 2, amp: 12, period: 60, phase: 0 },
    { t: 'spike', x: 1235, n: 20 },
    { t: 'spike', x: 1791, n: 20 },
    { t: 'spike', x: 2347, n: 20 },
    { t: 'spike', x: 2903, n: 20 },
    { t: 'spike', x: 3459, n: 20 },
    { t: 'spike', x: 4015, n: 20 },
    { t: 'spike', x: 4571, n: 20 },
    { t: 'fly', x: 5127, alt: 'LOW', vx: 2, amp: 16, period: 60, phase: 0 },
    { t: 'spike', x: 5535, n: 20 },
    { t: 'spike', x: 6091, n: 20 },
    { t: 'fly', x: 6647, alt: 'LOW', vx: 2, amp: 12, period: 60, phase: 0 },
    { t: 'spike', x: 7055, n: 20 },
    { t: 'spike', x: 7611, n: 20 },
    { t: 'spike', x: 8167, n: 20 },
    { t: 'spike', x: 8723, n: 20 },
    { t: 'spring', x: 9279 },
    { t: 'spike', x: 9687, n: 20 },
    { t: 'spike', x: 10243, n: 20 },
    { t: 'spike', x: 10799, n: 20 },
    { t: 'spike', x: 11355, n: 20 },
    { t: 'spike', x: 11911, n: 20 },
    { t: 'spike', x: 12467, n: 20 },
    { t: 'spike', x: 13023, n: 20 },
    { t: 'spike', x: 13381, n: 20 },
    { t: 'spike', x: 13739, n: 20 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spike', x: 14097, n: 20 },
    { t: 'spike', x: 14455, n: 20 },
    { t: 'spike', x: 14813, n: 20 },
    { t: 'spike', x: 15171, n: 20 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 15529 },
    { t: 'fly', x: 15735, alt: 'LOW', vx: 2, amp: 8, period: 60, phase: 0 },
    { t: 'block', x: 15945, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [29, 64], [103, 134], [226, 232], [337, 343], [449, 455], [560, 566], [671, 677], [782, 788],
    [893, 899], [963, 993], [1086, 1092], [1197, 1203], [1266, 1298], [1390, 1396], [1501, 1507], [1613, 1619],
    [1724, 1730], [1917, 1923], [2028, 2034], [2139, 2145], [2250, 2256], [2361, 2367], [2473, 2479], [2584, 2590],
    [2655, 2661], [2727, 2733], [2799, 2805], [2870, 2876], [2942, 2948], [3013, 3019], [3082, 3118], [3141, 3168],
  ],
}

// ---------------------------------------------------------------------------
// S10 TEST II — 速度 5.25 px/f / 52秒 / 16,478px
// 新要素: `spear` トラップ（G4 本体）＋ 章末試験＝全要素の複合
// 実測: 生存窓 6f（最悪 1f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.459 / 抑制率 0.061 / 複合度 0.021 /
//   D(t) 13.00 @85.2% / タップ 30本 = 0.57/秒 / クリア 3128f
//   **E[D_skill] = 104.4（目標 110）** [σ=30: 4.9 / σ=40: 104.4 / σ=50: 2851.3] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_10: StageDef = {
  id: 10,
  name: 'TEST II',
  speedPxPerFrame: 5.25,
  lengthPx: 16478,
  safeRunwayPx: 252,
  groundY: 148,
  objects: [
    { t: 'block', x: 427, w: 24, h: 16 },
    { t: 'spear', x: 1173, h: 52, triggerX: 1029, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 1901 },
    { t: 'block', x: 1989, w: 60, h: 32 },
    { t: 'block', x: 2057, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 2803 },
    { t: 'block', x: 2891, w: 60, h: 32 },
    { t: 'block', x: 2959, w: 24, h: 64 },
    { t: 'spear', x: 3705, h: 52, triggerX: 3561, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 4433 },
    { t: 'block', x: 4521, w: 60, h: 32 },
    { t: 'block', x: 4589, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 5335 },
    { t: 'block', x: 5423, w: 60, h: 32 },
    { t: 'block', x: 5491, w: 24, h: 64 },
    { t: 'spear', x: 6237, h: 52, triggerX: 6093, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6965 },
    { t: 'block', x: 7053, w: 60, h: 32 },
    { t: 'block', x: 7121, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 7867 },
    { t: 'block', x: 7955, w: 60, h: 32 },
    { t: 'block', x: 8023, w: 24, h: 64 },
    { t: 'spear', x: 8769, h: 52, triggerX: 8625, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 9497 },
    { t: 'block', x: 9585, w: 60, h: 32 },
    { t: 'block', x: 9653, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10399 },
    { t: 'block', x: 10487, w: 60, h: 32 },
    { t: 'block', x: 10555, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 11301 },
    { t: 'block', x: 11389, w: 60, h: 32 },
    { t: 'block', x: 11457, w: 24, h: 64 },
    { t: 'fly', x: 12203, alt: 'LOW', vx: 3, amp: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 12937 },
    { t: 'block', x: 13025, w: 60, h: 32 },
    { t: 'block', x: 13093, w: 24, h: 64 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 13839 },
    { t: 'block', x: 13927, w: 60, h: 32 },
    { t: 'block', x: 13995, w: 24, h: 64 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'drop', x: 14741, y: 108, triggerX: -1, falls: false },
    { t: 'swing', x: 15082, y: 132, amp: 24, period: 90, phase: 0 },
    { t: 'fly', x: 15447, alt: 'LOW', vx: 2, amp: 12, period: 60, phase: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 15784 },
    { t: 'ceil', x: 16117, w: 48, y: 96 },
    { t: 'block', x: 16490, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [30, 65], [188, 195], [331, 337], [366, 371], [503, 509], [538, 543], [670, 677], [814, 820],
    [849, 854], [985, 991], [1020, 1025], [1152, 1160], [1296, 1302], [1331, 1336], [1468, 1474], [1503, 1508],
    [1634, 1642], [1778, 1784], [1813, 1818], [1950, 1956], [1985, 1990], [2122, 2128], [2157, 2162], [2257, 2293],
    [2433, 2439], [2468, 2473], [2605, 2611], [2640, 2645], [2823, 2858], [2881, 2913],
  ],
}

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
