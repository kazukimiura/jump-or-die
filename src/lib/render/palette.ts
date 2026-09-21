/**
 * palette.ts — GB 4階調パレットと階調の用途割当
 *
 * 出典: shared/design/JumpOrDie_スタイルガイド.md §1 / §2
 *
 * 絶対制約:
 *   - 5色目を足さない。中間色・アルファ合成・グラデーション・ディザは禁止（スタイルガイド §9-1）
 *   - GB1 はプレイ領域では「致死物」と「プレイヤー」だけ（ルールA）
 *   - 上面に乗れる物体の最上行 1px は GB3（ルールB）
 *   - GB4 の白抜きはプレイヤーの目だけ（ルールC）
 *   - GB3 の文字を GB4 の地の上に置かない（1.88:1）。薄色が要るときは GB2
 *
 * React / zustand に依存しないこと（GDD §12-2）。
 */

/** GB1 墨 — 致死物・プレイヤー本体・レターボックス */
export const GB1 = '#081820'
/** GB2 深緑 — 非致死の実体・HUD 帯の地 */
export const GB2 = '#346856'
/** GB3 若草 — 乗れる面の縁・地面の質感・副次情報 */
export const GB3 = '#88C070'
/** GB4 淡 — 空・HUD の文字・プレイヤーの目 */
export const GB4 = '#E0F8D0'

/** 階調番号。ドット図の `1`〜`4` に 1:1 対応する */
export type Tone = 1 | 2 | 3 | 4

/** 通常パレット。index = Tone - 1 */
export const PALETTE: readonly [string, string, string, string] = [GB1, GB2, GB3, GB4]

/**
 * 階調反転パレット（GB1 ↔ GB4 / GB2 ↔ GB3）。
 *
 * 【改訂 R3 / 2026-09-21】死亡演出の死因表示は **中抜き反転**（sprites.ts の `hollowRows`）に
 * 変わったため、障害物の反転描画には**使わない**。単純階調反転は反転先が空と同色になり、
 * 対象が消えてしまうためである（スタイルガイド §5-3）。
 * 本パレットと `invertTone` は、RESULT の `NEW RECORD` の値反転のように
 * **地と文字を入れ替える表現**のために残してある。
 */
export const PALETTE_INV: readonly [string, string, string, string] = [GB4, GB3, GB2, GB1]

/** 階調反転。GB1↔GB4 / GB2↔GB3 */
export function invertTone(t: Tone): Tone {
  return (5 - t) as Tone
}

/** 階調 → CSS カラー */
export function toneColor(t: Tone, inverted = false): string {
  return (inverted ? PALETTE_INV : PALETTE)[t - 1]
}

/**
 * 用途別の階調割当。**この表にない組み合わせを描かないこと。**
 * （スタイルガイド §2 / §4-5 / §6）
 */
export const TONE = {
  /** 空 y12–147 */
  SKY: 4,
  /** 地面本体 */
  GROUND_BODY: 2,
  /** 地面上面ライン（乗れる面の縁） */
  GROUND_TOP: 3,
  /** 地面の質感ドット */
  GROUND_TEXTURE: 3,
  /** 致死物・プレイヤー本体 */
  LETHAL: 1,
  /** 非致死の実体（足場・バネ・崩落床） */
  SOLID_SAFE: 2,
  /** HUD 帯の地 */
  HUD_BG: 2,
  /** HUD 帯と プレイ領域の区切り 1px */
  HUD_RULE: 3,
  /** HUD の文字（GB2 の上）5.67:1 */
  HUD_TEXT: 4,
  /** HUD の副次情報（試行回数）3.01:1 */
  HUD_SUB_TEXT: 3,
  /** 進捗バーの未到達部 */
  BAR_REST: 3,
  /** 進捗バーの到達済み部 */
  BAR_DONE: 4,
  /** 進捗バーの刻み（ベスト・死亡マーカー） */
  BAR_MARK: 1,
  /** 空（GB4）の上のテキスト 15.9:1 */
  TEXT_ON_SKY: 1,
  /** 空の上の薄いテキスト 5.67:1（GB3 は使わない） */
  TEXT_ON_SKY_SUB: 2,
  /** 地面（GB2）の上のテキスト 5.67:1 */
  TEXT_ON_GROUND: 4,
  /** 地面の上の薄いテキスト 3.01:1 */
  TEXT_ON_GROUND_SUB: 3,
} as const satisfies Record<string, Tone>
