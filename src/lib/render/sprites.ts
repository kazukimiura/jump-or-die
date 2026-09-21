/**
 * sprites.ts — ドット図の文字列配列 → オフスクリーン canvas への bake（焼き込み）
 *
 * 出典: shared/design/JumpOrDie_ドット素材指示書.md §2 / §3 / §4-2 / §5 / §6-4 / §7
 *
 * 絶対制約:
 *   - **外部画像ファイル（PNG 等）を使わない。** 起動時に 1 度だけ canvas へ bake する
 *   - 記号: `.` = 透明 / `1` = GB1 / `2` = GB2 / `3` = GB3 / `4` = GB4
 *   - 行数・各行の文字数は宣言寸法と必ず一致する（`assertSprites()` で検証）
 *   - 飛行体の 2 コマは判定域 x2–9 / y2–9 の画素が 1px も違わない（`assertSprites()` で検証）
 *   - プレイヤー 4 コマの塗りの外接矩形は x1–12 / y0–15 で不変（`assertSprites()` で検証）
 *
 * React に依存しない純粋な TypeScript モジュール。
 */

import { PALETTE, PALETTE_INV } from './palette'
import { createCanvas } from './scale'

export type DotRows = readonly string[]

/* ============================================================================
 * SP-01 〜 SP-04  プレイヤー
 * ========================================================================== */

/**
 * プレイヤーの胴体（y2–y11）。**走行A・走行B・上昇・下降の 4 コマで完全に同一。**
 * ここを 1px でも変えると「今どこまでが自分か」が掴めなくなる（スタイルガイド §3-3）。
 * 目（GB4 の 2×2）は全コマで x8–9 / y4–5 に固定。まばたきさせない。
 */
const PLAYER_CORE: DotRows = [
  '....11111111....', // y2
  '....11111111....', // y3
  '....11114411....', // y4  目 GB4
  '....11114411....', // y5
  '....11111111....', // y6
  '...111111111....', // y7
  '.11.111111111...', // y8  排気口 x1–2（判定外）
  '.11.111111111...', // y9
  '....111111111...', // y10
  '....11111111....', // y11
]

export const SPR_PLAYER_RUN_A: DotRows = [
  '........1.......', // y0 アンテナ（判定外）
  '........1.......', // y1
  ...PLAYER_CORE,
  '.....11..111....', // y12 左脚が後ろ／右脚が前
  '.....11...11....', // y13
  '....111...11....', // y14
  '...1111...11....', // y15 つま先（判定外）
]

export const SPR_PLAYER_RUN_B: DotRows = [
  '........1.......',
  '........1.......',
  ...PLAYER_CORE,
  '....111..11.....', // y12 脚だけ入れ替える
  '....11...11.....', // y13
  '....11...111....', // y14
  '....11...1111...', // y15
]

export const SPR_PLAYER_RISE: DotRows = [
  '.......1........', // y0 アンテナが後ろ（左）へしなる
  '........1.......', // y1
  ...PLAYER_CORE,
  '....111..111....', // y12 脚を「く」の字に折りたたむ
  '.....11..11.....', // y13
  '....11....11....', // y14
  '...11......11...', // y15
]

export const SPR_PLAYER_FALL: DotRows = [
  '.........1......', // y0 アンテナが前（右）へ倒れる
  '........1.......', // y1
  ...PLAYER_CORE,
  '....11....11....', // y12 脚を真下に伸ばす（着地準備）
  '....11....11....', // y13
  '....11....11....', // y14
  '...111....111...', // y15
]

/** SP-04 死亡ドット片 4×4。4 個とも同じ形 */
export const SPR_CHUNK: DotRows = ['.11.', '1111', '1111', '.11.']

/* ============================================================================
 * SP-05 〜 SP-13  障害物 全10種
 * ========================================================================== */

/** 幅 w の行を階調 t で作る */
function fillRow(w: number, t: string): string {
  return t.repeat(w)
}

/** 上面 1px を GB3、それ以下を GB1 で塗る塊（ルールB: 上面に乗れる） */
function solidBlock(w: number, h: number): DotRows {
  const rows: string[] = [fillRow(w, '3')]
  for (let y = 1; y < h; y++) rows.push(fillRow(w, '1'))
  return rows
}

/** SP-05 OB-01 ブロック小 12×16 */
export const SPR_BLOCK_S: DotRows = solidBlock(12, 16)

/** SP-06 OB-02 ブロック大 24×32。OB-01 と意図的に同じ見た目 */
export const SPR_BLOCK_L: DotRows = solidBlock(24, 32)

/** SP-10 OB-07 昇降ブロック 16×16。OB-01 と同じ見た目（動くこと自体が識別情報） */
export const SPR_LIFTER: DotRows = solidBlock(16, 16)

/** SP-08 OB-04 天井 16×16 タイル。**上面の GB3 ラインは描かない（乗れない）** */
export const SPR_CEILING: DotRows = Array.from({ length: 16 }, () => fillRow(16, '1'))

/** SP-07 OB-06 トゲ 8×8。判定 x2–5 / y2–5 に合わせて逆算した形 */
export const SPR_SPIKE: DotRows = [
  '...11...',
  '...11...',
  '..1111..',
  '..1111..',
  '.111111.',
  '.111111.',
  '11111111',
  '11111111',
]

/** SP-09 OB-05 浮遊足場 32×8。**GB2 であることが「死なない」の宣言** */
export const SPR_PLATFORM: DotRows = [
  '33333333333333333333333333333333',
  '22222222222222222222222222222222',
  '22222222222222222222222222222222',
  '22222222222222222222222222222222',
  '22222222222222222222222222222222',
  '22222222222222222222222222222222',
  '.222222222222222222222222222222.',
  '..2222222222222222222222222222..',
]

/**
 * SP-12 OB-08 飛行体 12×12・2 コマ。
 * **判定域 x2–9 / y2–9 は 2 コマで 1px も変えない。翼は y0–1 と y10–11 だけで動かす。**
 */
const FLYER_BODY: DotRows = [
  '..11111111..', // y2 ┐ 判定域 x2–9 / y2–9
  '..11111111..', // y3 │
  '..11111111..', // y4 │
  '..111111111.', // y5 │ x10 のくちばしは判定外
  '..111111111.', // y6 │
  '..11111111..', // y7 │
  '..11111111..', // y8 │
  '..11111111..', // y9 ┘
]

export const SPR_FLYER_A: DotRows = [
  '.11......11.', // y0 翼が上（判定外）
  '.11......11.', // y1
  ...FLYER_BODY,
  '...1....1...', // y10 脚（判定外）
  '...1....1...', // y11
]

export const SPR_FLYER_B: DotRows = [
  '............', // y0
  '............', // y1
  ...FLYER_BODY,
  '.11......11.', // y10 翼が下がる
  '.11......11.', // y11
]

/** SP-11 OB-10 バネ 縮み 12×8（通常状態） */
export const SPR_SPRING_A: DotRows = [
  '.3333333333.', // GB3 上面 ＝ 乗れる（非致死）
  '.2222222222.',
  '.2........2.',
  '.2222222222.',
  '.2........2.',
  '.2222222222.',
  '.2........2.',
  '222222222222', // 台座
]

/** SP-11 OB-10 バネ 伸び 12×16（接触後 6 フレーム）。上へ伸びる */
export const SPR_SPRING_B: DotRows = [
  '.3333333333.',
  '.2222222222.',
  '.2........2.',
  '.2........2.',
  '.2222222222.',
  '.2........2.',
  '.2........2.',
  '.2222222222.',
  '.2........2.',
  '.2........2.',
  '.2222222222.',
  '.2........2.',
  '.2........2.',
  '.2222222222.',
  '.2........2.',
  '222222222222',
]

/** SP-13 OB-09 崩落床 24×8 コマ1（無傷） */
export const SPR_CRUMBLE_0: DotRows = [
  '333333333333333333333333',
  '222222222222222222222222',
  '222222222222222222222222',
  '222222222222222222222222',
  '222222222222222222222222',
  '222222222222222222222222',
  '222222222222222222222222',
  '.2222222222222222222222.',
]

/** y2–y5 の指定 x を GB4（空と同色）へ置き換え、「割れている」を一撃で伝える */
function crackRows(base: DotRows, xs: readonly number[]): DotRows {
  return base.map((row, y) => {
    if (y < 2 || y > 5) return row
    const chars = [...row]
    for (const x of xs) chars[x] = '4'
    return chars.join('')
  })
}

/** SP-13 コマ2（ひび 1 本・着地後 4–6f） */
export const SPR_CRUMBLE_1: DotRows = crackRows(SPR_CRUMBLE_0, [11])
/** SP-13 コマ3（ひび 3 本・着地後 7–9f） */
export const SPR_CRUMBLE_2: DotRows = crackRows(SPR_CRUMBLE_0, [5, 11, 17])

/* ============================================================================
 * SP-14  地面タイル（16 × 32・世界座標タイル）
 * ========================================================================== */

/** ステージごとに変えてよいのは質感ドット 3–4 個だけ。上面・高さ・パレットは全ステージ共通 */
const GROUND_TEXTURE_DOTS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [3, 6],
    [11, 14],
    [7, 22],
  ], // A: S1 FIRST STEP
  [
    [9, 5],
    [2, 13],
    [13, 25],
  ], // B: S2 TWIN BLOCK
  [
    [6, 8],
    [14, 17],
    [1, 27],
    [10, 29],
  ], // C: S3 THE GAP
]

function groundTile(patternIndex: 0 | 1 | 2): DotRows {
  const rows: string[] = []
  for (let y = 0; y < 32; y++) rows.push(fillRow(16, y < 2 ? '3' : '2'))
  for (const [x, y] of GROUND_TEXTURE_DOTS[patternIndex]) {
    const chars = [...rows[y]]
    chars[x] = '3'
    rows[y] = chars.join('')
  }
  return rows
}

export const SPR_GROUND_A: DotRows = groundTile(0)
export const SPR_GROUND_B: DotRows = groundTile(1)
export const SPR_GROUND_C: DotRows = groundTile(2)

/* ============================================================================
 * SP-15 〜 SP-17  アイコン
 * ========================================================================== */

/** SP-15 クリア星（塗り・GB1） */
export const SPR_STAR_FULL: DotRows = [
  '...11...',
  '...11...',
  '11111111',
  '.111111.',
  '..1111..',
  '.111111.',
  '.11..11.',
  '1.....1.',
]

/** SP-15 未クリア星（輪郭のみ・GB2）。※ ステージセレクトでは使わない（UIテキスト 11-2） */
export const SPR_STAR_EMPTY: DotRows = [
  '...22...',
  '...22...',
  '22222222',
  '.22..22.',
  '..2..2..',
  '.22..22.',
  '.22..22.',
  '2.....2.',
]

/** SP-16 未解放の錠 8×10（GB3） */
export const SPR_LOCK: DotRows = [
  '..3333..',
  '.33..33.',
  '.33..33.',
  '33333333',
  '33333333',
  '33333333',
  '333..333',
  '333..333',
  '33333333',
  '33333333',
]

/** SP-17 戻る `←` 8×8（GB1）。**タップ判定は 24×24 に拡げること** */
export const SPR_ARROW: DotRows = [
  '...1....',
  '..11....',
  '.111111.',
  '11111111',
  '11111111',
  '.111111.',
  '..11....',
  '...1....',
]

/* ============================================================================
 * SP-18 〜 SP-20  ロゴ `JUMP OR DIE`
 * ------------------------------------------------------------------------
 *  線幅は縦画・横画とも 4px 固定（OR のみ 2px）。角は直角。
 *  フォントの拡大では代用しない（素材指示書 §6-4）。
 * ========================================================================== */

/** 20×24 のロゴ字形を「行パターン × 行数」で組む */
function buildGlyph(spans: readonly (readonly [string, number])[]): DotRows {
  const rows: string[] = []
  for (const [pattern, count] of spans) {
    for (let i = 0; i < count; i++) rows.push(pattern)
  }
  return rows
}

const LOGO_J: DotRows = buildGlyph([
  ['11111111111111111111', 4],
  ['............1111....', 14],
  ['1111........1111....', 3],
  ['1111111111111111....', 3],
])

const LOGO_U: DotRows = buildGlyph([
  ['1111............1111', 20],
  ['11111111111111111111', 4],
])

const LOGO_M: DotRows = buildGlyph([
  ['11111111111111111111', 4],
  ['1111....1111....1111', 8],
  ['1111............1111', 12],
])

const LOGO_P: DotRows = buildGlyph([
  ['11111111111111111111', 4],
  ['1111............1111', 5],
  ['11111111111111111111', 4],
  ['1111................', 11],
])

const LOGO_D: DotRows = buildGlyph([
  ['1111111111111111....', 4],
  ['1111............1111', 16],
  ['1111111111111111....', 4],
])

const LOGO_I: DotRows = buildGlyph([
  ['11111111111111111111', 4],
  ['........1111........', 16],
  ['11111111111111111111', 4],
])

const LOGO_E: DotRows = buildGlyph([
  ['11111111111111111111', 4],
  ['1111................', 6],
  ['1111111111111111....', 4],
  ['1111................', 6],
  ['11111111111111111111', 4],
])

/** OR は 1・3 段目のちょうど半分（文字高 12px・線幅 2px）。主役を食わない */
const LOGO_O: DotRows = buildGlyph([
  ['1111111111', 2],
  ['11......11', 8],
  ['1111111111', 2],
])

const LOGO_R: DotRows = buildGlyph([
  ['1111111111', 2],
  ['11......11', 3],
  ['1111111111', 2],
  ['11..11....', 2],
  ['11....1111', 3],
])

/**
 * 右下 1px オフセットの GB2 影を、**同じ寸法の中に**焼き込む。
 * ぼかしなし・単色・1px 固定。これ以外の影は全画面で禁止（スタイルガイド §9-2）。
 */
function withShadow(rows: DotRows): DotRows {
  const w = rows[0].length
  const h = rows.length
  const out: string[] = []
  for (let y = 0; y < h; y++) {
    let line = ''
    for (let x = 0; x < w; x++) {
      if (rows[y][x] !== '.') line += '1'
      else if (y > 0 && x > 0 && rows[y - 1][x - 1] !== '.') line += '2'
      else line += '.'
    }
    out.push(line)
  }
  return out
}

/** 字間ぶんの透明列を挟んで横に連結する */
function joinGlyphs(glyphs: readonly DotRows[], gap: number): DotRows {
  const h = glyphs[0].length
  const spacer = '.'.repeat(gap)
  const rows: string[] = []
  for (let y = 0; y < h; y++) rows.push(glyphs.map((g) => g[y]).join(spacer))
  return rows
}

/** SP-18 92 × 24（GB1 本体 ＋ GB2 の右下 1px 影） */
export const SPR_LOGO_JUMP: DotRows = withShadow(joinGlyphs([LOGO_J, LOGO_U, LOGO_M, LOGO_P], 4))
/** SP-19 22 × 12（1・3 段目のちょうど半分。GB1 のみ・影なし） */
export const SPR_LOGO_OR: DotRows = joinGlyphs([LOGO_O, LOGO_R], 2)
/** SP-20 68 × 24（GB1 本体 ＋ GB2 の右下 1px 影） */
export const SPR_LOGO_DIE: DotRows = withShadow(joinGlyphs([LOGO_D, LOGO_I, LOGO_E], 4))

/* ============================================================================
 * スプライト表 と bake
 * ========================================================================== */

export type SpriteName =
  | 'PLAYER_RUN_A'
  | 'PLAYER_RUN_B'
  | 'PLAYER_RISE'
  | 'PLAYER_FALL'
  | 'CHUNK'
  | 'BLOCK_S'
  | 'BLOCK_L'
  | 'CEILING'
  | 'PLATFORM'
  | 'SPIKE'
  | 'LIFTER'
  | 'FLYER_A'
  | 'FLYER_B'
  | 'SPRING_A'
  | 'SPRING_B'
  | 'CRUMBLE_0'
  | 'CRUMBLE_1'
  | 'CRUMBLE_2'
  | 'GROUND_A'
  | 'GROUND_B'
  | 'GROUND_C'
  | 'STAR_FULL'
  | 'STAR_EMPTY'
  | 'LOCK'
  | 'ARROW'
  | 'LOGO_JUMP'
  | 'LOGO_OR'
  | 'LOGO_DIE'

/** 素材指示書 §1-1 の宣言寸法。`assertSprites()` がこの値と実データを突き合わせる */
export const SPRITE_DIMS: Record<SpriteName, readonly [number, number]> = {
  PLAYER_RUN_A: [16, 16],
  PLAYER_RUN_B: [16, 16],
  PLAYER_RISE: [16, 16],
  PLAYER_FALL: [16, 16],
  CHUNK: [4, 4],
  BLOCK_S: [12, 16],
  BLOCK_L: [24, 32],
  CEILING: [16, 16],
  PLATFORM: [32, 8],
  SPIKE: [8, 8],
  LIFTER: [16, 16],
  FLYER_A: [12, 12],
  FLYER_B: [12, 12],
  SPRING_A: [12, 8],
  SPRING_B: [12, 16],
  CRUMBLE_0: [24, 8],
  CRUMBLE_1: [24, 8],
  CRUMBLE_2: [24, 8],
  GROUND_A: [16, 32],
  GROUND_B: [16, 32],
  GROUND_C: [16, 32],
  STAR_FULL: [8, 8],
  STAR_EMPTY: [8, 8],
  LOCK: [8, 10],
  ARROW: [8, 8],
  LOGO_JUMP: [92, 24],
  LOGO_OR: [22, 12],
  LOGO_DIE: [68, 24],
}

export const SPRITES: Record<SpriteName, DotRows> = {
  PLAYER_RUN_A: SPR_PLAYER_RUN_A,
  PLAYER_RUN_B: SPR_PLAYER_RUN_B,
  PLAYER_RISE: SPR_PLAYER_RISE,
  PLAYER_FALL: SPR_PLAYER_FALL,
  CHUNK: SPR_CHUNK,
  BLOCK_S: SPR_BLOCK_S,
  BLOCK_L: SPR_BLOCK_L,
  CEILING: SPR_CEILING,
  PLATFORM: SPR_PLATFORM,
  SPIKE: SPR_SPIKE,
  LIFTER: SPR_LIFTER,
  FLYER_A: SPR_FLYER_A,
  FLYER_B: SPR_FLYER_B,
  SPRING_A: SPR_SPRING_A,
  SPRING_B: SPR_SPRING_B,
  CRUMBLE_0: SPR_CRUMBLE_0,
  CRUMBLE_1: SPR_CRUMBLE_1,
  CRUMBLE_2: SPR_CRUMBLE_2,
  GROUND_A: SPR_GROUND_A,
  GROUND_B: SPR_GROUND_B,
  GROUND_C: SPR_GROUND_C,
  STAR_FULL: SPR_STAR_FULL,
  STAR_EMPTY: SPR_STAR_EMPTY,
  LOCK: SPR_LOCK,
  ARROW: SPR_ARROW,
  LOGO_JUMP: SPR_LOGO_JUMP,
  LOGO_OR: SPR_LOGO_OR,
  LOGO_DIE: SPR_LOGO_DIE,
}

export interface SpriteRect {
  x: number
  y: number
  w: number
  h: number
}

/** アトラスの幅。スプライトは 1px 以上離して配置する（切り出しミスを目視で見つけるため） */
const ATLAS_W = 256

const rects = new Map<SpriteName, SpriteRect>()
let atlasMain: HTMLCanvasElement | null = null
let atlasInv: HTMLCanvasElement | null = null

/** シェルフ法で配置座標を決める。bake の前に 1 度だけ走る */
function layout(): number {
  if (rects.size > 0) {
    let max = 0
    for (const r of rects.values()) max = Math.max(max, r.y + r.h)
    return max
  }
  let cx = 1
  let cy = 1
  let shelfH = 0
  for (const name of Object.keys(SPRITES) as SpriteName[]) {
    const rows = SPRITES[name]
    const w = rows[0].length
    const h = rows.length
    if (cx + w + 1 > ATLAS_W) {
      cx = 1
      cy += shelfH + 1
      shelfH = 0
    }
    rects.set(name, { x: cx, y: cy, w, h })
    cx += w + 1
    shelfH = Math.max(shelfH, h)
  }
  return cy + shelfH + 1
}

function bake(palette: readonly [string, string, string, string], h: number): HTMLCanvasElement {
  const cv = createCanvas(ATLAS_W, h)
  const g = cv.getContext('2d')
  if (!g) throw new Error('2d context unavailable')
  g.imageSmoothingEnabled = false
  for (const [name, rect] of rects) {
    const rows = SPRITES[name]
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y]
      for (let x = 0; x < row.length; x++) {
        const ch = row.charCodeAt(x) - 48 // '1'..'4' → 1..4、'.' は負値
        if (ch < 1 || ch > 4) continue
        g.fillStyle = palette[ch - 1]
        g.fillRect(rect.x + x, rect.y + y, 1, 1)
      }
    }
  }
  return cv
}

/**
 * 起動時に 1 度だけ呼ぶ。2 枚のアトラス（通常・階調反転）を焼く。
 * **プレイ中に再実行してはならない。**
 */
export function initSprites(): void {
  if (atlasMain) return
  const h = layout()
  atlasMain = bake(PALETTE, h)
  atlasInv = bake(PALETTE_INV, h)
}

export function getAtlas(inverted = false): HTMLCanvasElement {
  if (!atlasMain || !atlasInv) initSprites()
  return (inverted ? atlasInv : atlasMain) as HTMLCanvasElement
}

export function spriteRect(name: SpriteName): SpriteRect {
  if (rects.size === 0) layout()
  const r = rects.get(name)
  if (!r) throw new Error(`unknown sprite: ${name}`)
  return r
}

/** スプライトを 1 枚そのまま描く。座標は必ず整数へ丸める */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: SpriteName,
  x: number,
  y: number,
  inverted = false,
): void {
  const r = spriteRect(name)
  ctx.drawImage(getAtlas(inverted), r.x, r.y, r.w, r.h, Math.round(x), Math.round(y), r.w, r.h)
}

/** スプライトの一部だけを切り出して描く（幅可変の反復・スライス用） */
export function drawSpritePart(
  ctx: CanvasRenderingContext2D,
  name: SpriteName,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  inverted = false,
): void {
  if (sw <= 0 || sh <= 0) return
  const r = spriteRect(name)
  ctx.drawImage(
    getAtlas(inverted),
    r.x + sx,
    r.y + sy,
    sw,
    sh,
    Math.round(dx),
    Math.round(dy),
    sw,
    sh,
  )
}

/* ============================================================================
 * 検証（素材指示書 §7-5）
 * ========================================================================== */

/** 指定矩形の画素を文字列化する（コマ間の一致検査用） */
function region(rows: DotRows, x0: number, y0: number, x1: number, y1: number): string {
  let s = ''
  for (let y = y0; y <= y1; y++) s += rows[y].slice(x0, x1 + 1)
  return s
}

/** 塗りの外接矩形 [minX, minY, maxX, maxY] */
function inkBounds(rows: DotRows): [number, number, number, number] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  })
  return [minX, minY, maxX, maxY]
}

/**
 * 全スプライトの整合性を検査し、違反の一覧を返す（空配列 = 合格）。
 * 起動時アサーションとして使う（素材指示書 §7-5 項目3・5・6）。
 */
export function assertSprites(): string[] {
  const errors: string[] = []

  // 1) 行数・各行の文字数が宣言寸法と一致するか
  for (const name of Object.keys(SPRITES) as SpriteName[]) {
    const rows = SPRITES[name]
    const [w, h] = SPRITE_DIMS[name]
    if (rows.length !== h) errors.push(`${name}: 行数 ${rows.length} ≠ 宣言 ${h}`)
    rows.forEach((row, y) => {
      if (row.length !== w) errors.push(`${name}: y${y} の文字数 ${row.length} ≠ 宣言 ${w}`)
      for (const ch of row) {
        if (ch !== '.' && (ch < '1' || ch > '4')) errors.push(`${name}: y${y} に不正な記号 '${ch}'`)
      }
    })
  }

  // 2) プレイヤー 4 コマの外接矩形が x1–12 / y0–15 で一致するか
  const playerFrames: SpriteName[] = ['PLAYER_RUN_A', 'PLAYER_RUN_B', 'PLAYER_RISE', 'PLAYER_FALL']
  for (const name of playerFrames) {
    const [minX, minY, maxX, maxY] = inkBounds(SPRITES[name])
    if (minX !== 1 || minY !== 0 || maxX !== 12 || maxY !== 15) {
      errors.push(`${name}: 外接矩形 x${minX}–${maxX} / y${minY}–${maxY} ≠ x1–12 / y0–15`)
    }
    // 判定内（x3–12 / y2–14）の輪郭は全コマ同一
    if (region(SPRITES[name], 3, 2, 12, 11) !== region(SPR_PLAYER_RUN_A, 3, 2, 12, 11)) {
      errors.push(`${name}: 胴体 y2–11 が走行コマAと一致しない`)
    }
  }

  // 3) 飛行体 2 コマの判定域 x2–9 / y2–9 が完全一致するか
  if (region(SPR_FLYER_A, 2, 2, 9, 9) !== region(SPR_FLYER_B, 2, 2, 9, 9)) {
    errors.push('FLYER: 判定域 x2–9 / y2–9 が 2 コマで一致しない')
  }

  // 4) 乗れない物体に GB3 の上面ラインが無いこと（ルールB）
  for (const name of ['CEILING', 'SPIKE', 'FLYER_A', 'FLYER_B'] as SpriteName[]) {
    if (SPRITES[name].some((row) => row.includes('3'))) {
      errors.push(`${name}: 乗れない物体に GB3 が含まれている（ルールB違反）`)
    }
  }

  // 5) GB4 の白抜きはプレイヤーの目と崩落床のひびだけ（ルールC）
  for (const name of Object.keys(SPRITES) as SpriteName[]) {
    if (name.startsWith('PLAYER') || name.startsWith('CRUMBLE')) continue
    if (SPRITES[name].some((row) => row.includes('4'))) {
      errors.push(`${name}: GB4 が使われている（ルールC違反）`)
    }
  }

  return errors
}
