/**
 * JumpOrDie — ステージデータ（GDD §16「全面再較正」に基づく全面作り直し・2026-09-22）
 *
 * 【この作り直しの根拠】
 * 社長が旧10本を**一度も死なずにクリア**した。原因は生存窓の最小値だけを規定し、
 * 通しクリア確率 `P = Π(1-p_i)` を一度も計算しなかったことによる。σ=40ms で
 * 旧設計を計算し直すと 10本合計の期待死亡回数は約0.5回で、**実測0回は設計どおり**だった。
 *
 * 【設計原理】
 *  - 難易度カーブを作るのは**窓ではなく狭窓の本数**。窓は 6〜9f でほぼ一定に保つ。
 *  - 各ステージの `E[D_skill]` を目標死亡回数の帯（0.7〜1.6倍）に入れる。章合計も 0.85〜1.35倍。
 *  - **1ステージ = 1新要素、S1 から投入**（初出は2要素まで・§16-10）。
 *  - **狭窓の出所は同一ユニット種 50% 以下**。記憶に残る像が「壁、壁、壁」になってはならない。
 *
 * 【誤帰属0 のために使わなかった形（実測で棄却）】
 *   - ブロックの階段（踏み外して落ちる間に他のブロックを「突破」する）
 *   - 天井 → 槍 を**離して**置いた複合（天井をくぐった後に槍で死ぬ）
 *   - **踏み台を離した WALL**（踏み台に乗った後に WALL で死ぬ）
 * 溶接（X範囲を密着させる）すれば誤帰属0になる。WALL は踏み台を 8px で密着させ、
 * `GATE` は `ceil` と下段の左右端を揃えてある。
 */
import type { StageBudget, StageDef } from '@/lib/game/types'

/**
 * 検査基準（GDD §6-3 / §16-2 / §16-10 / §16-11）。
 *
 * `deathTarget` は **`D_actual`（プレイヤーが実際に体験する死亡回数）の目標**。
 * `D_actual = E[D_skill] + D_learn` で、検査するのは `E[D_skill]` がその 5〜50% に
 * 入るかどうか。**`D_learn` は測るだけでモデル化しない**（3点では式を立てられない）。
 * **S1〜S4 は社長の実測で確定、S5〜S10 は暫定**（上端がまだ見えていない）。
 * 暫定目標に対しては上限側の判定を警告に落とす —— 仮置きの数字で不合格を出さない。
 * `tightDensity` は章の表の**下限のみ**で判定するのでここでは参考値（上限は撤廃）。
 * `objectCount` / `tapsPerSecond` は**実測の記録**であって設計値ではない（§15-16）。
 */
export const STAGE_BUDGETS: Record<number, StageBudget> = {
  1: { objectCount: 21, maxChain: 3, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.89, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.3], compositeRatio: [0, 0.6], tapsPerSecond: 0.66, deathTarget: 2, deathBand: [1, 4], measuredDeaths: 1 },
  2: { objectCount: 22, maxChain: 3, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.88, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.3], compositeRatio: [0, 0.6], tapsPerSecond: 0.66, deathTarget: 4, deathBand: [2, 8], measuredDeaths: 3 },
  3: { objectCount: 28, maxChain: 3, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.9, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.3], compositeRatio: [0, 0.8], tapsPerSecond: 0.71, deathTarget: 10, deathBand: [5, 20] },
  4: { objectCount: 38, maxChain: 4, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.87, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.35], compositeRatio: [0, 0.9], tapsPerSecond: 0.66, deathTarget: 30, deathBand: [20, 45], measuredDeaths: 37 },
  5: { objectCount: 38, maxChain: 5, windowMinFrames: 7, windowMaxFrames: 13, climaxAt: 0.9, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.35], compositeRatio: [0, 0.9], tapsPerSecond: 0.78, deathTarget: 45, deathBand: [28, 70], deathTargetProvisional: true },
  6: { objectCount: 35, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.91, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.35], compositeRatio: [0, 0.9], tapsPerSecond: 0.56, deathTarget: 60, deathBand: [37, 93], deathTargetProvisional: true },
  7: { objectCount: 36, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.87, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.35], compositeRatio: [0, 0.9], tapsPerSecond: 0.59, deathTarget: 75, deathBand: [47, 116], deathTargetProvisional: true },
  8: { objectCount: 36, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.89, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.4], compositeRatio: [0, 0.9], tapsPerSecond: 0.64, deathTarget: 90, deathBand: [56, 140], deathTargetProvisional: true },
  9: { objectCount: 36, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.86, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.4], compositeRatio: [0, 0.9], tapsPerSecond: 0.60, deathTarget: 110, deathBand: [68, 171], deathTargetProvisional: true },
  10: { objectCount: 45, maxChain: 5, windowMinFrames: 6, windowMaxFrames: 12, climaxAt: 0.88, climaxWarnOnly: false, tightDensity: [0, 9], suppressRatio: [0, 0.4], compositeRatio: [0, 0.95], tapsPerSecond: 0.70, deathTarget: 140, deathBand: [87, 217], deathTargetProvisional: true },
}

// ---------------------------------------------------------------------------
// S1 FIRST STEP — 速度 3 px/f / 32秒 / 5,742px
// 新要素: `block` — 跳ぶという操作そのもの ＋ `spear` 静止
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 3 / 誤帰属 0 /
//   狭窓密度 0.470 / 抑制率 0.000 / 複合度 0.267 /
//   D(t) 12.75 @88.9% / タップ 21本 = 0.66/秒 / クリア 1896f
//   狭窓の出所 15本: spear 15本
//   **E[D_skill] = 5.0（目標 5）** [σ=30: 0.7 / σ=40: 5.0 / σ=50: 29.2] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_1: StageDef = {
  id: 1,
  name: 'FIRST STEP',
  speedPxPerFrame: 3,
  lengthPx: 5742,
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
    { t: 'spear', x: 2988, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3257, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 3526, h: 51, triggerX: -1, rise: 8 },
    { t: 'block', x: 3795, w: 24, h: 16 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 4082 },
    { t: 'spear', x: 4353, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4622, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 4812, h: 51, triggerX: -1, rise: 8 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spear', x: 5002, h: 51, triggerX: -1, rise: 8 },
    { t: 'spear', x: 5192, h: 51, triggerX: -1, rise: 8 },
    { t: 'block', x: 5382, w: 24, h: 32 },
    { t: 'block', x: 5590, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [20, 55], [116, 151], [228, 235], [318, 324], [407, 414], [497, 504], [587, 593], [664, 691],
    [772, 779], [862, 868], [951, 958], [1041, 1048], [1131, 1137], [1204, 1239], [1406, 1413], [1496, 1503],
    [1559, 1566], [1623, 1629], [1686, 1693], [1737, 1764], [1806, 1833],
  ],
}

// ---------------------------------------------------------------------------
// S2 GAP — 速度 3.1 px/f / 33秒 / 6,170px
// 新要素: `pit` / `spike`
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.482 / 抑制率 0.000 / 複合度 0.000 /
//   D(t) 12.00 @88.0% / タップ 22本 = 0.66/秒 / クリア 1973f
//   狭窓の出所 16本: spear 8本 / spike 8本
//   **E[D_skill] = 7.7（目標 8）** [σ=30: 1.0 / σ=40: 7.7 / σ=50: 53.6] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_2: StageDef = {
  id: 2,
  name: 'GAP',
  speedPxPerFrame: 3.1,
  lengthPx: 6170,
  safeRunwayPx: 149,
  groundY: 148,
  objects: [
    { t: 'block', x: 252, w: 24, h: 16 },
    { t: 'pit', x: 496, w: 56 },
    { t: 'spear', x: 772, h: 51, triggerX: -1, rise: 8 },
    { t: 'spike', x: 998, n: 12 },
    { t: 'spear', x: 1314, h: 51, triggerX: -1, rise: 8 },
    { t: 'spike', x: 1540, n: 12 },
    { t: 'spear', x: 1856, h: 51, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2082, n: 12 },
    { t: 'pit', x: 2398, w: 80 },
    { t: 'spear', x: 2698, h: 51, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2924, n: 12 },
    { t: 'spear', x: 3240, h: 51, triggerX: -1, rise: 8 },
    { t: 'spike', x: 3466, n: 12 },
    { t: 'spear', x: 3782, h: 51, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 4008 },
    { t: 'spike', x: 4236, n: 12 },
    { t: 'pit', x: 4552, w: 96 },
    { t: 'spear', x: 4868, h: 51, triggerX: -1, rise: 8 },
    { t: 'spike', x: 5050, n: 12 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spear', x: 5322, h: 51, triggerX: -1, rise: 8 },
    { t: 'spike', x: 5504, n: 12 },
    { t: 'block', x: 5776, w: 24, h: 32 },
    { t: 'block', x: 5976, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [21, 56], [113, 143], [205, 212], [293, 299], [380, 386], [468, 474], [555, 561], [642, 649],
    [735, 757], [826, 833], [914, 920], [1001, 1008], [1089, 1095], [1176, 1183], [1337, 1343], [1435, 1452],
    [1526, 1533], [1600, 1606], [1673, 1679], [1746, 1752], [1806, 1834], [1871, 1898],
  ],
}

// ---------------------------------------------------------------------------
// S3 THORN — 速度 3.5 px/f / 39秒 / 8,227px
// 新要素: `spear` の反復（狭窓の主力へ）
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 3 / 誤帰属 0 /
//   狭窓密度 0.562 / 抑制率 0.000 / 複合度 0.000 /
//   D(t) 11.25 @89.9% / タップ 28本 = 0.71/秒 / クリア 2335f
//   狭窓の出所 22本: spear 11本 / spike 11本
//   **E[D_skill] = 10.1（目標 12）** [σ=30: 1.0 / σ=40: 10.1 / σ=50: 105.2] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_3: StageDef = {
  id: 3,
  name: 'THORN',
  speedPxPerFrame: 3.5,
  lengthPx: 8227,
  safeRunwayPx: 168,
  groundY: 148,
  objects: [
    { t: 'block', x: 285, w: 24, h: 16 },
    { t: 'pit', x: 542, w: 88 },
    { t: 'spear', x: 863, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 1102, n: 13 },
    { t: 'spear', x: 1439, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 1678, n: 13 },
    { t: 'spear', x: 2015, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2254, n: 13 },
    { t: 'spear', x: 2591, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2830, n: 13 },
    { t: 'block', x: 3167, w: 24, h: 32 },
    { t: 'spear', x: 3424, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 3663, n: 13 },
    { t: 'spear', x: 4000, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 4239, n: 13 },
    { t: 'spear', x: 4576, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 4815, n: 13 },
    { t: 'spear', x: 5152, h: 52, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 5391 },
    { t: 'spike', x: 5632, n: 13 },
    { t: 'pit', x: 5969, w: 104 },
    { t: 'spear', x: 6306, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 6498, n: 13 },
    { t: 'spear', x: 6788, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 6980, n: 13 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spear', x: 7270, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 7462, n: 13 },
    { t: 'block', x: 7752, w: 24, h: 16 },
    { t: 'block', x: 7962, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [23, 59], [118, 140], [206, 212], [287, 294], [370, 376], [451, 459], [535, 541], [616, 623],
    [699, 705], [780, 788], [851, 878], [937, 943], [1018, 1026], [1102, 1108], [1183, 1191], [1266, 1273],
    [1347, 1355], [1431, 1437], [1581, 1589], [1673, 1691], [1761, 1767], [1828, 1836], [1898, 1905], [1966, 1974],
    [2036, 2042], [2104, 2111], [2157, 2192], [2221, 2248],
  ],
}

// ---------------------------------------------------------------------------
// S4 LOW SKY — 速度 3.75 px/f / 40秒 / 8,903px
// 新要素: `ceil` ＋ **`GATE`（門）**
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 1 / 誤帰属 0 /
//   狭窓密度 0.607 / 抑制率 0.316 / 複合度 0.224 /
//   D(t) 12.00 @87.4% / タップ 26本 = 0.66/秒 / クリア 2360f
//   狭窓の出所 24本: spear 8本 / GATE 8本 / spike 8本
//   **E[D_skill] = 17.7（目標 18）** [σ=30: 1.5 / σ=40: 17.7 / σ=50: 251.4] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_4: StageDef = {
  id: 4,
  name: 'LOW SKY',
  speedPxPerFrame: 3.75,
  lengthPx: 8903,
  safeRunwayPx: 180,
  groundY: 148,
  objects: [
    { t: 'block', x: 305, w: 24, h: 16 },
    { t: 'ceil', x: 579, w: 48, y: 96 },
    { t: 'spear', x: 877, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 1133, w: 6, y: 63 },
    { t: 'spear', x: 1133, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 1389, n: 14 },
    { t: 'spear', x: 1751, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 2007, w: 6, y: 63 },
    { t: 'spear', x: 2007, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2263, n: 14 },
    { t: 'spear', x: 2625, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 2881, w: 6, y: 63 },
    { t: 'spear', x: 2881, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 3137, w: 48, y: 88 },
    { t: 'spike', x: 3435, n: 14 },
    { t: 'spear', x: 3797, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 4053, w: 6, y: 63 },
    { t: 'spear', x: 4053, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 4309, n: 14 },
    { t: 'spear', x: 4671, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 4927, w: 6, y: 63 },
    { t: 'spear', x: 4927, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 5183, n: 14 },
    { t: 'spear', x: 5545, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 5801, w: 48, y: 96 },
    { t: 'ceil', x: 6099, w: 6, y: 63 },
    { t: 'spear', x: 6099, h: 52, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6355 },
    { t: 'spike', x: 6613, n: 14 },
    { t: 'spear', x: 6925, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 7131, w: 6, y: 63 },
    { t: 'spear', x: 7131, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 7337, n: 14 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spear', x: 7649, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 7855, w: 6, y: 63 },
    { t: 'spear', x: 7855, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 8061, n: 14 },
    { t: 'ceil', x: 8373, w: 48, y: 104 },
    { t: 'block', x: 8621, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [24, 60], [194, 200], [262, 269], [343, 351], [427, 433], [495, 502], [577, 584], [660, 666],
    [728, 735], [889, 897], [973, 979], [1041, 1047], [1122, 1130], [1206, 1212], [1274, 1280], [1355, 1363],
    [1439, 1445], [1586, 1593], [1737, 1744], [1807, 1813], [1862, 1868], [1930, 1937], [2000, 2006], [2055, 2061],
    [2123, 2130], [2246, 2273],
  ],
}

// ---------------------------------------------------------------------------
// S5 PENDULUM — 速度 4 px/f / 39秒 / 9,286px
// 新要素: `swing`（G1 障害物が動く）＋ 章末試験
// 実測: 生存窓 7f（最悪 7f）/ 連鎖 3 / 誤帰属 0 /
//   狭窓密度 0.620 / 抑制率 0.211 / 複合度 0.223 /
//   D(t) 12.42 @89.9% / タップ 30本 = 0.78/秒 / クリア 2308f
//   狭窓の出所 24本: spear 8本 / GATE 8本 / spike 8本
//   **E[D_skill] = 24.8（目標 25）** [σ=30: 1.8 / σ=40: 24.8 / σ=50: 400.6] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_5: StageDef = {
  id: 5,
  name: 'PENDULUM',
  speedPxPerFrame: 4,
  lengthPx: 9286,
  safeRunwayPx: 192,
  groundY: 148,
  objects: [
    { t: 'block', x: 325, w: 24, h: 16 },
    { t: 'swing', x: 599, y: 132, amp: 16, period: 90, phase: 0 },
    { t: 'spear', x: 881, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 1137, w: 6, y: 63 },
    { t: 'spear', x: 1137, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 1393, n: 16 },
    { t: 'spear', x: 1771, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 2027, w: 6, y: 63 },
    { t: 'spear', x: 2027, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2283, n: 16 },
    { t: 'spear', x: 2661, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 2917, w: 6, y: 63 },
    { t: 'spear', x: 2917, h: 52, triggerX: -1, rise: 8 },
    { t: 'swing', x: 3173, y: 132, amp: 24, period: 90, phase: 0 },
    { t: 'spike', x: 3463, n: 16 },
    { t: 'spear', x: 3841, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 4097, w: 6, y: 63 },
    { t: 'spear', x: 4097, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 4353, n: 16 },
    { t: 'spear', x: 4731, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 4987, w: 6, y: 63 },
    { t: 'spear', x: 4987, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 5243, n: 16 },
    { t: 'spear', x: 5621, h: 52, triggerX: -1, rise: 8 },
    { t: 'swing', x: 5877, y: 132, amp: 32, period: 90, phase: 0 },
    { t: 'ceil', x: 6175, w: 6, y: 63 },
    { t: 'spear', x: 6175, h: 52, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6431 },
    { t: 'spike', x: 6689, n: 16 },
    { t: 'spear', x: 7067, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 7323, w: 6, y: 63 },
    { t: 'spear', x: 7323, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 7579, n: 16 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spear', x: 7957, h: 52, triggerX: -1, rise: 8 },
    { t: 'ceil', x: 8213, w: 6, y: 63 },
    { t: 'spear', x: 8213, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 8419, n: 16 },
    { t: 'swing', x: 8747, y: 132, amp: 24, period: 90, phase: 0 },
    { t: 'block', x: 8987, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [26, 61], [98, 133], [181, 188], [245, 252], [324, 330], [404, 410], [468, 474], [547, 553],
    [626, 633], [690, 697], [742, 777], [842, 848], [921, 928], [985, 992], [1064, 1070], [1144, 1150],
    [1208, 1214], [1287, 1293], [1366, 1373], [1416, 1452], [1505, 1511], [1648, 1654], [1728, 1734], [1792, 1798],
    [1871, 1877], [1950, 1957], [2014, 2021], [2081, 2087], [2133, 2168], [2195, 2222],
  ],
}

// ---------------------------------------------------------------------------
// S6 THE WALL — 速度 4.25 px/f / 47秒 / 11,860px
// 新要素: WALL + 踏み台（G2）＋ `plat`
// 実測: 生存窓 6f（最悪 1f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.452 / 抑制率 0.229 / 複合度 0.000 /
//   D(t) 17.25 @91.2% / タップ 26本 = 0.56/秒 / クリア 2778f
//   狭窓の出所 21本: WALL 10本 / GATE 8本 / spike 3本
//   **E[D_skill] = 31.1（目標 35）** [σ=30: 2.4 / σ=40: 31.1 / σ=50: 496.4] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_6: StageDef = {
  id: 6,
  name: 'THE WALL',
  speedPxPerFrame: 4.25,
  lengthPx: 11860,
  safeRunwayPx: 204,
  groundY: 148,
  objects: [
    { t: 'block', x: 346, w: 24, h: 16 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 848 },
    { t: 'block', x: 936, w: 48, h: 32 },
    { t: 'block', x: 992, w: 24, h: 64 },
    { t: 'ceil', x: 1494, w: 6, y: 63 },
    { t: 'spear', x: 1494, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 1978, n: 16 },
    { t: 'ceil', x: 2584, w: 6, y: 63 },
    { t: 'spear', x: 2584, h: 52, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3068 },
    { t: 'block', x: 3156, w: 52, h: 32 },
    { t: 'block', x: 3216, w: 24, h: 64 },
    { t: 'spike', x: 3718, n: 16 },
    { t: 'ceil', x: 4324, w: 6, y: 63 },
    { t: 'spear', x: 4324, h: 53, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 4808 },
    { t: 'block', x: 4896, w: 48, h: 32 },
    { t: 'block', x: 4952, w: 24, h: 64 },
    { t: 'ceil', x: 5454, w: 6, y: 63 },
    { t: 'spear', x: 5454, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 5938, n: 16 },
    { t: 'ceil', x: 6544, w: 6, y: 63 },
    { t: 'spear', x: 6544, h: 52, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 7028 },
    { t: 'block', x: 7116, w: 52, h: 32 },
    { t: 'block', x: 7176, w: 24, h: 64 },
    { t: 'spike', x: 7678, n: 16 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 8284 },
    { t: 'ceil', x: 8770, w: 6, y: 63 },
    { t: 'spear', x: 8770, h: 53, triggerX: -1, rise: 8 },
    { t: 'plat', x: 9254, y: 108 },
    { t: 'ceil', x: 9764, w: 6, y: 63 },
    { t: 'spear', x: 9764, h: 53, triggerX: -1, rise: 8 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'spike', x: 10248, n: 16 },
    { t: 'ceil', x: 10663, w: 6, y: 63 },
    { t: 'spear', x: 10663, h: 52, triggerX: -1, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10956 },
    { t: 'block', x: 11044, w: 52, h: 32 },
    { t: 'block', x: 11104, w: 24, h: 64 },
    { t: 'plat', x: 11415, y: 100 },
    { t: 'block', x: 11734, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [27, 62], [170, 176], [205, 210], [314, 319], [441, 448], [570, 577], [692, 699], [727, 733],
    [850, 858], [980, 985], [1101, 1108], [1136, 1142], [1246, 1251], [1372, 1380], [1502, 1508], [1624, 1631],
    [1659, 1665], [1782, 1789], [2026, 2031], [2130, 2140], [2260, 2265], [2387, 2394], [2471, 2477], [2548, 2555],
    [2583, 2589], [2710, 2737],
  ],
}

// ---------------------------------------------------------------------------
// S7 VERMIN — 速度 4.5 px/f / 51秒 / 13,744px
// 新要素: `mouse`（G3 正面から飛んでくる）
// 実測: 生存窓 6f（最悪 1f）/ 連鎖 3 / 誤帰属 0 /
//   狭窓密度 0.471 / 抑制率 0.167 / 複合度 0.000 /
//   D(t) 20.00 @86.6% / タップ 30本 = 0.59/秒 / クリア 3042f
//   狭窓の出所 24本: WALL 12本 / GATE 6本 / spike 6本
//   **E[D_skill] = 37.7（目標 45）** [σ=30: 2.6 / σ=40: 37.7 / σ=50: 670.7] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_7: StageDef = {
  id: 7,
  name: 'VERMIN',
  speedPxPerFrame: 4.5,
  lengthPx: 13744,
  safeRunwayPx: 216,
  groundY: 148,
  objects: [
    { t: 'block', x: 366, w: 24, h: 16 },
    { t: 'fly', x: 953, alt: 'LOW', vx: 2, amp: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 1528 },
    { t: 'block', x: 1616, w: 52, h: 32 },
    { t: 'block', x: 1676, w: 24, h: 64 },
    { t: 'ceil', x: 2263, w: 6, y: 62 },
    { t: 'spear', x: 2263, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2832, n: 18 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3539 },
    { t: 'block', x: 3627, w: 52, h: 32 },
    { t: 'block', x: 3687, w: 24, h: 64 },
    { t: 'ceil', x: 4274, w: 6, y: 62 },
    { t: 'spear', x: 4274, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 4843, n: 18 },
    { t: 'fly', x: 5550, alt: 'LOW', vx: 3, amp: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6125 },
    { t: 'block', x: 6213, w: 52, h: 32 },
    { t: 'block', x: 6273, w: 24, h: 64 },
    { t: 'ceil', x: 6860, w: 6, y: 62 },
    { t: 'spear', x: 6860, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 7429, n: 18 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 8136 },
    { t: 'block', x: 8224, w: 52, h: 32 },
    { t: 'block', x: 8284, w: 24, h: 64 },
    { t: 'ceil', x: 8871, w: 6, y: 62 },
    { t: 'spear', x: 8871, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 9440, n: 18 },
    { t: 'fly', x: 10147, alt: 'LOW', vx: 2.5, amp: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10722 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10983 },
    { t: 'block', x: 11071, w: 52, h: 32 },
    { t: 'block', x: 11131, w: 24, h: 64 },
    { t: 'ceil', x: 11408, w: 6, y: 62 },
    { t: 'spear', x: 11408, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 11667, n: 18 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 12064 },
    { t: 'block', x: 12152, w: 52, h: 32 },
    { t: 'block', x: 12212, w: 24, h: 64 },
    { t: 'ceil', x: 12489, w: 6, y: 62 },
    { t: 'spear', x: 12489, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 12748, n: 18 },
    { t: 'fly', x: 13145, alt: 'LOW', vx: 3.5, amp: 0 },
    { t: 'block', x: 13410, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [28, 63], [143, 178], [309, 316], [344, 350], [465, 472], [607, 613], [756, 763], [791, 797],
    [912, 919], [1054, 1060], [1159, 1195], [1331, 1337], [1366, 1371], [1487, 1494], [1629, 1635], [1778, 1784],
    [1813, 1818], [1934, 1941], [2076, 2081], [2183, 2219], [2410, 2417], [2445, 2451], [2498, 2505], [2571, 2576],
    [2651, 2657], [2686, 2691], [2738, 2745], [2811, 2817], [2853, 2880], [2930, 2957],
  ],
}

// ---------------------------------------------------------------------------
// S8 FALLOUT — 速度 4.75 px/f / 44秒 / 12,527px
// 新要素: `drop`（G5 浮遊オブジェクトの落下）
// 実測: 生存窓 6f（最悪 1f）/ 連鎖 3 / 誤帰属 0 /
//   狭窓密度 0.546 / 抑制率 0.222 / 複合度 0.000 /
//   D(t) 20.00 @89.3% / タップ 28本 = 0.64/秒 / クリア 2626f
//   狭窓の出所 24本: WALL 12本 / GATE 6本 / spike 6本
//   **E[D_skill] = 59.1（目標 60）** [σ=30: 3.5 / σ=40: 59.1 / σ=50: 1214.2] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_8: StageDef = {
  id: 8,
  name: 'FALLOUT',
  speedPxPerFrame: 4.75,
  lengthPx: 12527,
  safeRunwayPx: 228,
  groundY: 148,
  objects: [
    { t: 'block', x: 386, w: 24, h: 16 },
    { t: 'drop', x: 865, y: 108, triggerX: -1, falls: false },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 1336 },
    { t: 'block', x: 1424, w: 56, h: 32 },
    { t: 'block', x: 1488, w: 24, h: 64 },
    { t: 'ceil', x: 1967, w: 6, y: 63 },
    { t: 'spear', x: 1967, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2428, n: 19 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3035 },
    { t: 'block', x: 3123, w: 56, h: 32 },
    { t: 'block', x: 3187, w: 24, h: 64 },
    { t: 'ceil', x: 3666, w: 6, y: 63 },
    { t: 'spear', x: 3666, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 4127, n: 19 },
    { t: 'drop', x: 4734, y: 108, triggerX: 4434, falls: true, tell: true },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 5205 },
    { t: 'block', x: 5293, w: 56, h: 32 },
    { t: 'block', x: 5357, w: 24, h: 64 },
    { t: 'ceil', x: 5836, w: 6, y: 63 },
    { t: 'spear', x: 5836, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 6297, n: 19 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6904 },
    { t: 'block', x: 6992, w: 56, h: 32 },
    { t: 'block', x: 7056, w: 24, h: 64 },
    { t: 'ceil', x: 7535, w: 6, y: 63 },
    { t: 'spear', x: 7535, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 7996, n: 19 },
    { t: 'drop', x: 8603, y: 100, triggerX: -1, falls: false },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 9074 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 9537 },
    { t: 'block', x: 9625, w: 56, h: 32 },
    { t: 'block', x: 9689, w: 24, h: 64 },
    { t: 'ceil', x: 10168, w: 6, y: 63 },
    { t: 'spear', x: 10168, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 10424, n: 19 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10826 },
    { t: 'block', x: 10914, w: 56, h: 32 },
    { t: 'block', x: 10978, w: 24, h: 64 },
    { t: 'ceil', x: 11252, w: 6, y: 63 },
    { t: 'spear', x: 11252, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 11508, n: 19 },
    { t: 'drop', x: 11910, y: 108, triggerX: 11510, falls: true, tell: true },
    { t: 'block', x: 12176, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [28, 63], [251, 257], [286, 291], [378, 383], [490, 496], [608, 615], [643, 649], [736, 741],
    [847, 853], [949, 979], [1065, 1072], [1100, 1106], [1193, 1198], [1304, 1310], [1423, 1430], [1458, 1464],
    [1550, 1556], [1662, 1668], [1977, 1984], [2012, 2018], [2105, 2110], [2173, 2179], [2249, 2255], [2284, 2289],
    [2333, 2338], [2401, 2407], [2460, 2490], [2514, 2542],
  ],
}

// ---------------------------------------------------------------------------
// S9 WINGBEAT — 速度 5 px/f / 49秒 / 14,611px
// 新要素: `fly` 上下動（G6）＋ `spring`
// 実測: 生存窓 6f（最悪 1f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.493 / 抑制率 0.171 / 複合度 0.000 /
//   D(t) 19.00 @86.1% / タップ 29本 = 0.60/秒 / クリア 2911f
//   狭窓の出所 24本: WALL 12本 / GATE 6本 / spike 6本
//   **E[D_skill] = 80.5（目標 80）** [σ=30: 4.2 / σ=40: 80.5 / σ=50: 1834.9] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_9: StageDef = {
  id: 9,
  name: 'WINGBEAT',
  speedPxPerFrame: 5,
  lengthPx: 14611,
  safeRunwayPx: 240,
  groundY: 148,
  objects: [
    { t: 'block', x: 407, w: 24, h: 16 },
    { t: 'fly', x: 973, alt: 'LOW', vx: 2, amp: 12, period: 60, phase: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 1527 },
    { t: 'block', x: 1615, w: 56, h: 32 },
    { t: 'block', x: 1679, w: 24, h: 64 },
    { t: 'ceil', x: 2245, w: 6, y: 63 },
    { t: 'spear', x: 2245, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2793, n: 20 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3495 },
    { t: 'block', x: 3583, w: 56, h: 32 },
    { t: 'block', x: 3647, w: 24, h: 64 },
    { t: 'ceil', x: 4213, w: 6, y: 63 },
    { t: 'spear', x: 4213, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 4761, n: 20 },
    { t: 'fly', x: 5463, alt: 'LOW', vx: 2, amp: 16, period: 60, phase: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 6017 },
    { t: 'block', x: 6105, w: 56, h: 32 },
    { t: 'block', x: 6169, w: 24, h: 64 },
    { t: 'ceil', x: 6735, w: 6, y: 63 },
    { t: 'spear', x: 6735, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 7283, n: 20 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 7985 },
    { t: 'block', x: 8073, w: 56, h: 32 },
    { t: 'block', x: 8137, w: 24, h: 64 },
    { t: 'ceil', x: 8703, w: 6, y: 63 },
    { t: 'spear', x: 8703, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 9251, n: 20 },
    { t: 'fly', x: 9953, alt: 'LOW', vx: 2, amp: 12, period: 60, phase: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10507 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 10894 },
    { t: 'block', x: 10982, w: 56, h: 32 },
    { t: 'block', x: 11046, w: 24, h: 64 },
    { t: 'ceil', x: 11449, w: 6, y: 63 },
    { t: 'spear', x: 11449, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 11834, n: 20 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 12373 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    { t: 'block', x: 12461, w: 56, h: 32 },
    { t: 'block', x: 12525, w: 24, h: 64 },
    { t: 'ceil', x: 12928, w: 6, y: 63 },
    { t: 'spear', x: 12928, h: 53, triggerX: -1, rise: 8 },
    { t: 'spike', x: 13313, n: 20 },
    { t: 'spring', x: 13852 },
    { t: 'block', x: 14243, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [29, 64], [131, 163], [275, 281], [310, 315], [414, 419], [538, 544], [668, 674], [703, 708],
    [807, 813], [931, 937], [1029, 1061], [1173, 1179], [1208, 1213], [1312, 1317], [1436, 1442], [1566, 1572],
    [1601, 1606], [1705, 1711], [1829, 1835], [1927, 1959], [2148, 2154], [2183, 2188], [2254, 2260], [2346, 2352],
    [2444, 2450], [2479, 2484], [2550, 2556], [2642, 2648], [2800, 2828],
  ],
}

// ---------------------------------------------------------------------------
// S10 TEST II — 速度 5.25 px/f / 53秒 / 16,740px
// 新要素: `spear` トラップ（G4 本体）＋ 章末試験＝全要素の複合
// 実測: 生存窓 6f（最悪 1f）/ 連鎖 2 / 誤帰属 0 /
//   狭窓密度 0.546 / 抑制率 0.178 / 複合度 0.000 /
//   D(t) 18.25 @87.9% / タップ 37本 = 0.70/秒 / クリア 3178f
//   狭窓の出所 29本: spear 3本 / WALL 14本 / GATE 5本 / spike 7本
//   **E[D_skill] = 109.6（目標 110）** [σ=30: 4.1 / σ=40: 109.6 / σ=50: 4614.3] / D_knowledge = 0
// ---------------------------------------------------------------------------
const STAGE_10: StageDef = {
  id: 10,
  name: 'TEST II',
  speedPxPerFrame: 5.25,
  lengthPx: 16740,
  safeRunwayPx: 252,
  groundY: 148,
  objects: [
    { t: 'block', x: 427, w: 24, h: 16 },
    { t: 'spear', x: 889, h: 52, triggerX: 745, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 1333 },
    { t: 'block', x: 1421, w: 60, h: 32 },
    { t: 'block', x: 1489, w: 24, h: 64 },
    { t: 'ceil', x: 1951, w: 6, y: 63 },
    { t: 'spear', x: 1951, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 2395, n: 21 },
    { t: 'spear', x: 3001, h: 52, triggerX: 2857, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 3445 },
    { t: 'block', x: 3533, w: 60, h: 32 },
    { t: 'block', x: 3601, w: 24, h: 64 },
    { t: 'ceil', x: 4063, w: 6, y: 63 },
    { t: 'spear', x: 4063, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 4507, n: 21 },
    { t: 'spear', x: 5113, h: 52, triggerX: 4969, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 5557 },
    { t: 'block', x: 5645, w: 60, h: 32 },
    { t: 'block', x: 5713, w: 24, h: 64 },
    { t: 'ceil', x: 6175, w: 6, y: 63 },
    { t: 'spear', x: 6175, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 6619, n: 21 },
    { t: 'spear', x: 7225, h: 52, triggerX: 7081, rise: 8 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 7669 },
    { t: 'block', x: 7757, w: 60, h: 32 },
    { t: 'block', x: 7825, w: 24, h: 64 },
    { t: 'ceil', x: 8287, w: 6, y: 63 },
    { t: 'spear', x: 8287, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 8731, n: 21 },
    { t: 'fly', x: 9337, alt: 'LOW', vx: 3, amp: 0 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 9787 },
    { t: 'block', x: 9875, w: 60, h: 32 },
    { t: 'block', x: 9943, w: 24, h: 64 },
    { t: 'ceil', x: 10405, w: 6, y: 63 },
    { t: 'spear', x: 10405, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 10849, n: 21 },
    { t: 'drop', x: 11455, y: 108, triggerX: -1, falls: false },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 11909 },
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 12355 },
    { t: 'block', x: 12443, w: 60, h: 32 },
    { t: 'block', x: 12511, w: 24, h: 64 },
    { t: 'ceil', x: 12973, w: 6, y: 63 },
    { t: 'spear', x: 12973, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 13417, n: 21 },
    { t: 'swing', x: 14023, y: 132, amp: 24, period: 90, phase: 0 },
    // クライマックス帯（到達率 85〜95%）— D(t) のピークはここに置く
    // 予告マーカー（§7-3 ルールB）
    { t: 'warn', x: 14501 },
    { t: 'block', x: 14589, w: 60, h: 32 },
    { t: 'block', x: 14657, w: 24, h: 64 },
    { t: 'ceil', x: 15119, w: 6, y: 63 },
    { t: 'spear', x: 15119, h: 52, triggerX: -1, rise: 8 },
    { t: 'spike', x: 15475, n: 21 },
    { t: 'fly', x: 15993, alt: 'LOW', vx: 2, amp: 12, period: 60, phase: 0 },
    { t: 'block', x: 16355, w: 24, h: 32 },
  ],
  // σ の実測用（§16-7）。推奨ルート上の各タップの生存窓 [最初, 最後]
  tapWindows: [
    [30, 65], [134, 141], [223, 229], [258, 263], [336, 343], [436, 442], [536, 543], [625, 631],
    [660, 665], [738, 745], [838, 844], [938, 945], [1028, 1034], [1063, 1068], [1140, 1148], [1241, 1247],
    [1340, 1348], [1430, 1436], [1465, 1470], [1543, 1550], [1643, 1649], [1711, 1747], [1833, 1839], [1868, 1873],
    [1946, 1953], [2046, 2052], [2322, 2329], [2357, 2363], [2435, 2443], [2535, 2541], [2623, 2658], [2731, 2737],
    [2766, 2771], [2844, 2851], [2927, 2933], [2985, 3017], [3068, 3095],
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
