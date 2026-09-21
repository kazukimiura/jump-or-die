/**
 * draw.ts — 背景・地面・障害物・プレイヤー・HUD・テキストの描画関数群
 *
 * 出典: スタイルガイド §3 / §5 / §6、ドット素材指示書 §3 / §4 / §5、
 *       GDD §11、UIテキスト 10–17章、shared/reports/02_構成承認待ち.md ✅承認済み・采配裁定
 *
 * 絶対制約:
 *   - 論理解像度 320×180 固定。HUD は y0–11 に押し込み、プレイ領域 y12–179 に重ねない
 *   - 小数座標に物を置かない（描画直前に Math.round）
 *   - アニメの位相は `stageFrame` / `uiFrame` / `worldX` の純関数。時刻・乱数を使わない
 *   - React / zustand に依存しない。HUD の数値は canvas に描く（DOM を更新しない）
 *
 * 用語（采配裁定 2026-09-21）:
 *   - 通算死亡回数は `DEATHS 1204`
 *   - `NEW BEST` = 到達率の更新 / `NEW RECORD` = クリアタイムの更新（統一しない）
 *   - 感嘆符は `GO!` のみ
 */

import { PALETTE, TONE, type Tone } from './palette'
import {
  drawText,
  measureText,
  initFont,
  assertFonts,
  bakeTextTile,
  type FontId,
} from './font'
import {
  drawSprite,
  drawSpritePart,
  initSprites,
  assertSprites,
  type SpriteName,
} from './sprites'
import { LOGICAL_H, LOGICAL_W, PLAYER_X } from './scale'
import type {
  ExitPromptPhase,
  RenderDeath,
  RenderObstacle,
  RenderSelectEntry,
  RenderState,
} from './renderState'

/* ============================================================================
 * 初期化
 * ========================================================================== */

/**
 * 起動時に 1 度だけ呼ぶ。スプライトとフォントをオフスクリーン canvas へ焼く。
 * **プレイ中に呼んではならない**（素材指示書 §7-5 項目2）。
 */
export function initRender(): void {
  initSprites()
  initFont()
  initExitLabel()
  if (process.env.NODE_ENV !== 'production') {
    const errors = [...assertSprites(), ...assertFonts()]
    if (errors.length > 0) console.error('[render] 素材の検査に失敗:\n' + errors.join('\n'))
  }
}

/* ============================================================================
 * 低レベルのユーティリティ
 * ========================================================================== */

/** 矩形塗り。階調で指定する（パレット外の色を作らせない） */
export function fillRect(
  ctx: CanvasRenderingContext2D,
  tone: Tone,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = PALETTE[tone - 1]
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** 1px の輪郭。`reducedFlash` の縁取りに使う */
function strokeRect1(
  ctx: CanvasRenderingContext2D,
  tone: Tone,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  fillRect(ctx, tone, x, y, w, 1)
  fillRect(ctx, tone, x, y + h - 1, w, 1)
  fillRect(ctx, tone, x, y, 1, h)
  fillRect(ctx, tone, x + w - 1, y, 1, h)
}

/** 30f ON / 30f OFF（1 秒周期）の点滅 */
export function blink30(uiFrame: number): boolean {
  return (((uiFrame % 60) + 60) % 60) < 30
}

/** 2 桁ゼロ埋め（`ST 01`・`STAGE 04`） */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/**
 * 到達率の表記。**小数第1位まで固定・切り捨て**。
 * 未クリアで `100.0%` を出すことは本作で最も致命的な嘘なので、100 未満は 99.9% で頭打ちにする。
 */
export function formatPct(v: number): string {
  const clamped = Math.max(0, Math.min(100, v))
  let tenths = Math.floor(clamped * 10)
  if (clamped < 100) tenths = Math.min(tenths, 999)
  return `${(tenths / 10).toFixed(1)}%`
}

/** `00:41.32`（分:秒.1/100秒・すべてゼロ埋め） */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms))
  const m = Math.floor(total / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const c = Math.floor((total % 1000) / 10)
  return `${pad2(m)}:${pad2(s)}.${pad2(c)}`
}

/* ============================================================================
 * 背景・地面
 * ========================================================================== */

/** 空 — y12–147 を GB4 のベタで塗るだけ。雲・星・遠景・パララックスは入れない */
export function drawSky(ctx: CanvasRenderingContext2D, top = 12): void {
  fillRect(ctx, TONE.SKY, 0, top, LOGICAL_W, LOGICAL_H - top)
}

/** 章タイルの並び。index = 章 0–5（I–VI） */
const GROUND_TILES: readonly SpriteName[] = [
  'GROUND_I',
  'GROUND_II',
  'GROUND_III',
  'GROUND_IV',
  'GROUND_V',
  'GROUND_VI',
]

/** 1 章あたりのステージ数 */
export const STAGES_PER_CHAPTER = 5
/** 章の総数 */
export const CHAPTER_COUNT = 6

/**
 * ステージ番号 → 章（0–5）。**`Math.floor((id - 1) / 5)` で機械的に決まる。**
 * ステージデータに背景指定を持たせないこと（章とパターンがずれた状態を作れてしまう）。
 * エンジン側もこの関数を使うこと（章の境目を二重に持たない）。
 */
export function chapterOf(stageId: number): number {
  const c = Math.floor((stageId - 1) / STAGES_PER_CHAPTER)
  return Math.max(0, Math.min(CHAPTER_COUNT - 1, c))
}

/**
 * 地面 — 16px 幅のタイルを世界座標に敷き詰める。スクロールはオフセットだけで済む。
 * 谷（OB-03）の区間はタイルを描かず、空と同色（GB4）のまま残す。
 * **GB3 の上面ラインがそこで途切れることが「穴」の唯一かつ最速の合図**（ルールB）。
 */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  cam: number,
  stage: RenderState['stage'],
): void {
  const gy = stage.groundY
  const tile = GROUND_TILES[chapterOf(stage.id)] ?? 'GROUND_I'
  const first = Math.floor(cam / 16) * 16
  for (let wx = first; wx < cam + LOGICAL_W; wx += 16) {
    drawSprite(ctx, tile, wx - cam, gy)
  }
  for (const pit of stage.pits) {
    const sx = pit.worldX - cam
    if (sx + pit.w <= 0 || sx >= LOGICAL_W) continue
    fillRect(ctx, TONE.SKY, sx, gy, pit.w, LOGICAL_H - gy)
  }
}

/* ============================================================================
 * 障害物 全10種
 * ========================================================================== */

/** OB-01 ブロック小 12×16。上面 1px の GB3 が「乗れる」の記号 */
export function drawBlockS(ctx: CanvasRenderingContext2D, x: number, y: number, hollow = false): void {
  drawSprite(ctx, 'BLOCK_S', x, y, hollow)
}

/** OB-02 ブロック大 24×32。OB-01 と意図的に同じ見た目 */
export function drawBlockL(ctx: CanvasRenderingContext2D, x: number, y: number, hollow = false): void {
  drawSprite(ctx, 'BLOCK_L', x, y, hollow)
}

/**
 * OB-03 谷。**スプライトを持たない。** 地形側（drawGround の pits）で表現する。
 * 障害物リストに混ざっていても描画は何もしない。
 */
export function drawPit(): void {
  /* 地面を描かない区間として drawGround が処理する */
}

/** OB-04 天井。16×16 の GB1 ベタタイルを反復。**上面の GB3 ラインは描かない（乗れない）** */
export function drawCeiling(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hollow = false,
): void {
  for (let dy = 0; dy < h; dy += 16) {
    const sh = Math.min(16, h - dy)
    for (let dx = 0; dx < w; dx += 16) {
      const sw = Math.min(16, w - dx)
      drawSpritePart(ctx, 'CEILING', 0, 0, sw, sh, x + dx, y + dy, hollow)
    }
  }
}

/** OB-05 浮遊足場。32×8 を 3 スライス（左8 / 中16反復 / 右8）で任意幅に伸ばす */
export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  hollow = false,
): void {
  const edge = 8
  if (w <= edge * 2) {
    drawSpritePart(ctx, 'PLATFORM', 0, 0, w, 8, x, y, hollow)
    return
  }
  drawSpritePart(ctx, 'PLATFORM', 0, 0, edge, 8, x, y, hollow)
  let dx = edge
  const midW = w - edge * 2
  while (dx < edge + midW) {
    const sw = Math.min(16, edge + midW - dx)
    drawSpritePart(ctx, 'PLATFORM', 8, 0, sw, 8, x + dx, y, hollow)
    dx += sw
  }
  drawSpritePart(ctx, 'PLATFORM', 32 - edge, 0, edge, 8, x + w - edge, y, hollow)
}

/** OB-06 トゲ。8×8 を隙間なく並べ、束として 1 つの障害物に見せる */
export function drawSpike(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  hollow = false,
): void {
  for (let dx = 0; dx < w; dx += 8) {
    drawSpritePart(ctx, 'SPIKE', 0, 0, Math.min(8, w - dx), 8, x + dx, y, hollow)
  }
}

/** OB-07 昇降ブロック 16×16。見た目は OB-01 と同じ。動いていること自体が識別情報 */
export function drawLifter(ctx: CanvasRenderingContext2D, x: number, y: number, hollow = false): void {
  drawSprite(ctx, 'LIFTER', x, y, hollow)
}

/**
 * OB-08 飛行体 12×12・2 コマ。切り替えは `Math.floor(stageFrame / 6) % 2`。
 * **判定域 x2–9 / y2–9 は 2 コマで 1px も変わらない**（嘘の学習を防ぐ最重要規定）。
 */
export function drawFlyer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stageFrame: number,
  hollow = false,
  frameOverride?: number,
): void {
  const f = frameOverride ?? Math.floor(stageFrame / 6) % 2
  drawSprite(ctx, f === 0 ? 'FLYER_A' : 'FLYER_B', x, y, hollow)
}

/** OB-09 崩落床 24×8・3 コマ（無傷 / ひび1 / ひび3）。ひびは GB4 で「空が透けて見える」 */
export function drawCrumble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  frame: number,
  hollow = false,
): void {
  const name: SpriteName = frame >= 2 ? 'CRUMBLE_2' : frame === 1 ? 'CRUMBLE_1' : 'CRUMBLE_0'
  for (let dx = 0; dx < w; dx += 24) {
    drawSpritePart(ctx, name, 0, 0, Math.min(24, w - dx), 8, x + dx, y, hollow)
  }
}

/** OB-10 バネ 12×8 /12×16・2 コマ。伸びコマは台座を地面に固定したまま上へ伸びる */
export function drawSpring(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottomY: number,
  frame: number,
  hollow = false,
): void {
  const name: SpriteName = frame === 1 ? 'SPRING_B' : 'SPRING_A'
  const h = frame === 1 ? 16 : 8
  drawSprite(ctx, name, x, bottomY - h, hollow)
}

/* ----------------------------------------------------------------------------
 * ステージ拡張の新ギミック（GDD §15 / スタイルガイド §2-6 / 指示書 §7A・R16）
 * -------------------------------------------------------------------------- */

/**
 * WALL 表現に切り替わる高さ。**単発ジャンプで越えられなくなる高さと完全に一致させる。**
 *
 * **この分岐は `block` 専用。`spear`（h 40〜52）には適用しない。**
 * 誤適用すると槍の設計域が丸ごと禁止帯に重なり、G4 が成立しなくなる。
 * そのため `drawSpear()` は高さによる分岐を一切持たない別系統にしてある。
 */
export const WALL_MIN_H = 56

/**
 * 汎用ブロック。**`h ≥ 56` なら自動で WALL 表現（GB1 外周 2px ＋ 内部 GB2）に切り替える。**
 *
 * 単発ジャンプの到達は 52px、WALL は 56px 以上で差は 4px しかない。同じ絵にすると
 * 「いつもの block」と判断して跳び、4px 足りずに死ぬ ——
 * **画面上に情報が存在しないことによる死**になる。
 * 内部 GB2 の面積は `(w−4) × (h−5)` で**高いほど中身が大きく見える**ので、
 * プレイヤーは 4px の差を測らずに「中身が見えるほど高い」を覚えるだけで済む。
 *
 * 判定（全辺 1px 内側）は外周 GB1 の帯の中に完全に含まれるため、
 * プレイヤーが内部 GB2 に触れることは物理的に起こらない＝嘘にならない。
 */
export function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hollow = false,
): void {
  if (w <= 0 || h <= 0) return
  if (hollow) {
    // 中抜き反転（R3）: 外周 1px を GB1 のまま残し、内側を GB4 に抜く
    fillRect(ctx, 4, x, y, w, h)
    strokeRect1(ctx, 1, x, y, w, h)
    return
  }
  if (h >= WALL_MIN_H) {
    fillRect(ctx, 1, x, y, w, h) // 外周 GB1
    fillRect(ctx, 2, x + 2, y + 3, w - 4, h - 5) // 内部 GB2（＝地面本体と同じ色）
    fillRect(ctx, 3, x, y, w, 1) // 上面 GB3（乗れる。ルールB）
    return
  }
  fillRect(ctx, 1, x, y, w, h) // GB1 ベタ
  fillRect(ctx, 3, x, y, w, 1) // 上面 GB3
}

/** OB-11 横振りブロック 16×16。判定は block と同一で、四隅の面取りだけが違う */
export function drawSwing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hollow = false,
): void {
  drawSprite(ctx, 'SWING', x, y, hollow)
}

/** `fly` LOW（地上型）＝ ネズミ 12×12・2 コマ。判定域 x2–9 / y2–9 は 2 コマで不変 */
export function drawMouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stageFrame: number,
  hollow = false,
  frameOverride?: number,
): void {
  const f = frameOverride ?? Math.floor(stageFrame / 6) % 2
  drawSprite(ctx, f === 0 ? 'MOUSE_A' : 'MOUSE_B', x, y, hollow)
}

/** 伏せ槍の高さ（常に 2px） */
export const SPEAR_DOWN_H = 2
/** 槍の視覚幅 */
export const SPEAR_W = 6

/**
 * `spear` が致死かどうか。**`riseStart` と同一フレームで true になる。**
 * エンジン側もこの関数を使うこと（描画と判定を同じ式から出し、1 フレームのずれを構造的に消す）。
 */
export function spearIsLethal(stageFrame: number, riseStart: number): boolean {
  return stageFrame >= riseStart
}

/**
 * `spear` の現在の視覚高さ（＝判定高さ）。`H(f) = h × clamp((f − riseStart) / rise, 0, 1)` の線形。
 * **`H(f) = 0` の間も 2px を返す**（判定が既に立っているため、見た目を先に立たせる）。
 * `maxH` は 40〜52 の可変値。固定値を決め打ちしないこと。
 */
export function spearVisualHeight(
  stageFrame: number,
  riseStart: number,
  rise: number,
  maxH: number,
): number {
  if (stageFrame < riseStart) return SPEAR_DOWN_H
  const t = rise <= 0 ? 1 : Math.max(0, Math.min(1, (stageFrame - riseStart) / rise))
  return Math.max(SPEAR_DOWN_H, Math.round(maxH * t))
}

/**
 * `spear` を描く。**階調を決めるのは `lethal` ただ一つ**で、`h` は大きさだけを決める。
 *
 * - `lethal === false`（伏せ）→ **GB2 の 6×2**。踏めるものを黒く描けば嘘になる
 * - `lethal === true` → **GB1**。穂先は常に最上部（槍は下から押し上げられる）
 *
 * **高さによる分岐を持たない**（WALL の禁止帯は block 専用で、槍には適用しない）。
 */
export function drawSpear(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottomY: number,
  h: number,
  lethal: boolean,
  hollow = false,
): void {
  if (!lethal) {
    drawSprite(ctx, 'SPEAR_DOWN', x, bottomY - SPEAR_DOWN_H, hollow)
    return
  }
  const vh = Math.max(SPEAR_DOWN_H, Math.round(h))
  // 最大高スプライトの **上端から vh 行**を切り出す（穂先が常に最上部に来る）
  drawSpritePart(ctx, 'SPEAR', 0, 0, SPEAR_W, vh, x, bottomY - vh, hollow)
}

/**
 * 伏せ槍の直下 6px は、地面上面の GB3 ラインを描かない（GB2 に落とす）。
 *
 * **谷（OB-03）で教えた文法をそのまま再利用している。** 新しい記号を 1 つも増やさない。
 * 谷は「線が途切れ、その先に地面が無い（GB4 の穴）」、槍は「線が途切れるが、地面は続いている（GB2）」。
 * 結果は違うが前置きは同じ ——「ここは普通の地面ではない」。
 */
export function drawSpearGroundBreaks(
  ctx: CanvasRenderingContext2D,
  s: RenderState,
  cam: number,
): void {
  const gy = s.stage.groundY
  for (const ob of s.obstacles) {
    if (ob.kind !== 'SPEAR' || ob.hidden) continue
    if ((ob.frame ?? 0) !== 0) continue // 伸長中は槍そのものが見えるので不要
    const x = ob.worldX - cam
    if (x + SPEAR_W <= 0 || x >= LOGICAL_W) continue
    fillRect(ctx, TONE.GROUND_BODY, x, gy, SPEAR_W, 2)
  }
}

/**
 * 殺した障害物 1 個だけを **中抜き反転** で描くか（スタイルガイド §5-3 改訂 R3）。
 *
 * - 通常: **3f 中抜き / 3f 通常** を 1 往復（計 6f ＝ 100ms）
 * - `reducedFlash`: **同じ中抜きを点滅させず 6f 間そのまま静止表示**する。
 *   差は「往復させるかどうか」だけで、アトラスも処理も本編と共有する
 *
 * 画面全体のフラッシュ・他の障害物への波及は禁止。
 */
function killerHollow(s: RenderState, id: number): boolean {
  const d = s.death
  if (!d || d.killerId !== id) return false
  if (d.frame >= 6) return false
  return s.reducedFlash ? true : d.frame % 6 < 3
}

/** 障害物 1 個を描く。画面外はカリングする */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  s: RenderState,
  ob: RenderObstacle,
  cam: number,
): void {
  if (ob.hidden) return
  const x = ob.worldX - cam
  if (x + ob.w <= 0 || x >= LOGICAL_W) return
  const hollow = killerHollow(s, ob.id)

  switch (ob.kind) {
    case 'BLOCK_S':
      drawBlockS(ctx, x, ob.y, hollow)
      break
    case 'BLOCK_L':
      drawBlockL(ctx, x, ob.y, hollow)
      break
    case 'PIT':
      drawPit()
      break
    case 'CEILING':
      drawCeiling(ctx, x, ob.y, ob.w, ob.h, hollow)
      break
    case 'PLATFORM':
      drawPlatform(ctx, x, ob.y, ob.w, hollow)
      break
    case 'SPIKE':
      drawSpike(ctx, x, ob.y, ob.w, hollow)
      break
    case 'LIFTER':
      drawLifter(ctx, x, ob.y, hollow)
      break
    case 'FLYER':
      drawFlyer(ctx, x, ob.y, s.stageFrame, hollow, ob.frame)
      break
    case 'CRUMBLE':
      drawCrumble(ctx, x, ob.y, ob.w, ob.frame ?? 0, hollow)
      break
    case 'SPRING':
      drawSpring(ctx, x, ob.y + ob.h, ob.frame ?? 0, hollow)
      break
    case 'BLOCK':
      drawBlock(ctx, x, ob.y, ob.w, ob.h, hollow)
      break
    case 'SWING':
      drawSwing(ctx, x, ob.y, hollow)
      break
    case 'MOUSE':
      drawMouse(ctx, x, ob.y, s.stageFrame, hollow, ob.frame)
      break
    case 'SPEAR':
      // frame が階調を決める唯一の入力（0 = 伏せ・非致死 / 1 = 伸長・致死）
      drawSpear(ctx, x, ob.y + ob.h, ob.h, (ob.frame ?? 0) !== 0, hollow)
      break
  }
}

/* ============================================================================
 * プレイヤー
 * ========================================================================== */

/** 走行コマは **時間ではなく距離** で切り替える（速度が上がれば脚も速く回る・決定論的） */
export function runFrameOf(worldX: number): 0 | 1 {
  const n = Math.floor(worldX / 12)
  return (((n % 2) + 2) % 2) as 0 | 1
}

export function drawPlayer(ctx: CanvasRenderingContext2D, s: RenderState): void {
  if (!s.player.visible) return
  const m = s.player.motion
  const name: SpriteName =
    m === 'RISE'
      ? 'PLAYER_RISE'
      : m === 'FALL'
        ? 'PLAYER_FALL'
        : runFrameOf(s.player.worldX) === 0
          ? 'PLAYER_RUN_A'
          : 'PLAYER_RUN_B'
  drawSprite(ctx, name, PLAYER_X, s.player.y)
}

/** BURST のドット片。重力 0.24 px/f²。回転・縮小・フェードはしない */
const CHUNK_V: readonly (readonly [number, number])[] = [
  [-1.6, -2.6],
  [-0.6, -3.0],
  [0.7, -2.8],
  [1.7, -2.2],
]
const CHUNK_GRAVITY = 0.24
/** HITSTOP 6f のあとに BURST が始まる */
const BURST_START = 6
/** BURST は 11f。12 フレーム目に一括で消す */
const BURST_FRAMES = 11

export function drawChunks(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const d = s.death
  if (!d) return
  const t = d.frame - BURST_START
  if (t < 0 || t >= BURST_FRAMES) return
  const ox = 64 // 致死ボックス中心
  const oy = s.player.y + 8
  for (const [vx, vy] of CHUNK_V) {
    const x = ox + vx * t
    const y = oy + vy * t + 0.5 * CHUNK_GRAVITY * t * t
    drawSprite(ctx, 'CHUNK', x - 2, y - 2)
  }
}

/* ============================================================================
 * HUD（y 0–11）
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 * 離脱導線 `← STAGES`（アイドル顕在化・スタイルガイド §6-3-1 / 改訂 R9）
 *
 * 性質は「見つけてほしいが、目立ってはいけない」。
 * `READY` でタップが 90f 無いときだけ、HUD 左端の `ST nn` と **差し替えて** 出す。
 * **`RUNNING` 中は描画も判定も一切置かない（絶対規定）。**
 * -------------------------------------------------------------------------- */

/** ラベルの描画起点（`ST nn` と同一位置。重ねずに差し替える） */
export const EXIT_LABEL_X = 4
export const EXIT_LABEL_Y = 3
/** 文言。`←` と `STAGES` の間は半角スペース 1 つ。**詰めないこと**（文脈 恵の指定） */
export const EXIT_LABEL_TEXT = '← STAGES'
/** 出現までのアイドル（1.5 秒） */
export const EXIT_IDLE_FRAMES = 90
/** 各段 6f。ベタ到達は +12f、タップ受付開始は +18f */
export const EXIT_FADE_STEP = 6

/** 淡 25% → 濃 50% 市松 → ベタ の 3 枚。起動時に 1 度だけ焼く */
let exitLabel: HTMLCanvasElement[] | null = null

function initExitLabel(): void {
  if (exitLabel) return
  exitLabel = [
    bakeTextTile(EXIT_LABEL_TEXT, EXIT_LABEL_X, EXIT_LABEL_Y, {
      font: 'F3X5',
      tone: TONE.HUD_SUB_TEXT,
      dither: 'quarter25',
    }),
    bakeTextTile(EXIT_LABEL_TEXT, EXIT_LABEL_X, EXIT_LABEL_Y, {
      font: 'F3X5',
      tone: TONE.HUD_SUB_TEXT,
      dither: 'checker50',
    }),
    bakeTextTile(EXIT_LABEL_TEXT, EXIT_LABEL_X, EXIT_LABEL_Y, {
      font: 'F3X5',
      tone: TONE.HUD_SUB_TEXT,
      dither: 'solid',
    }),
  ]
}

/**
 * アイドル経過フレーム → 表示段階。
 * **しきい値を二重に持たないよう、エンジン層もこの関数を使うこと。**
 * `idleFrames` は `READY` 突入後にタップが無いまま経過したフレーム数。
 */
export function exitPromptPhaseOf(idleFrames: number): ExitPromptPhase {
  const t = idleFrames - EXIT_IDLE_FRAMES
  if (t < 0) return 'HIDDEN'
  if (t < EXIT_FADE_STEP) return 'FADE_25'
  if (t < EXIT_FADE_STEP * 2) return 'FADE_50'
  if (t < EXIT_FADE_STEP * 3) return 'SOLID'
  return 'ACTIVE'
}

/** タップを受け付けてよい段階か。ベタ到達から 6f の猶予を置く（詰めないこと） */
export function isExitTapAccepted(phase: ExitPromptPhase | undefined): boolean {
  return phase === 'ACTIVE'
}

/**
 * タップ判定の矩形（キャンバス左上起点・論理 px）。**描画より広い。**
 * 論理 12px は等倍で 12 CSS px しかなく指では押せないため、描画と判定を分離する。
 * どの `scale` でも 44×44 CSS px 以上を満たす。
 * **この矩形には一切描画しない**（枠線・背景・ハイライトを描かない）。
 */
export function exitTapRegion(scale: number): { x: number; y: number; w: number; h: number } {
  return { x: 0, y: 0, w: 56, h: Math.max(12, Math.ceil(44 / Math.max(1, scale))) }
}

/**
 * 離脱導線を描く。**`READY` 以外では何もしない。**
 * state 側が古い値を持っていても `RUNNING` 中に出ないよう、ここで二重に閉じている。
 */
export function drawExitPrompt(ctx: CanvasRenderingContext2D, s: RenderState): boolean {
  if (s.phase !== 'READY') return false
  const phase = s.exitPrompt ?? 'HIDDEN'
  if (phase === 'HIDDEN') return false
  initExitLabel()
  const index = phase === 'FADE_25' ? 0 : phase === 'FADE_50' ? 1 : 2
  const tile = exitLabel![index]
  // 焼いた 1 枚を drawImage 1 回で置く（等倍・整数座標）
  ctx.drawImage(
    tile,
    0,
    0,
    tile.width,
    tile.height,
    EXIT_LABEL_X,
    EXIT_LABEL_Y,
    tile.width,
    tile.height,
  )
  return true
}

/** 進捗バー 160×6（x80–239 / y4–9）。未到達 GB3 / 到達済み GB4 / 刻み GB1 */
export function drawProgressBar(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const x0 = 80
  const y0 = 4
  const w = 160
  const h = 6
  fillRect(ctx, TONE.BAR_REST, x0, y0, w, h)
  const done = Math.round(w * Math.max(0, Math.min(1, s.hud.progress)))
  if (done > 0) fillRect(ctx, TONE.BAR_DONE, x0, y0, done, h)

  // 描画順: 未到達 → 到達済み → 死亡マーカー → ベスト刻み（ベスト刻みが最前面）
  if (!s.hud.practice) {
    for (const m of s.hud.marks) {
      const mx = x0 + Math.round((w - 1) * Math.max(0, Math.min(1, m)))
      fillRect(ctx, TONE.BAR_MARK, mx, y0 + 4, 1, 2) // 下 2px だけ
    }
  }
  if (s.hud.best != null) {
    const bx = x0 + Math.round((w - 1) * Math.max(0, Math.min(1, s.hud.best)))
    fillRect(ctx, TONE.BAR_MARK, bx, y0, 1, h) // 全高
  }
}

/**
 * HUD 帯。**プレイ中に出す情報は 3 つだけ**（`ST 03` / 進捗バー / `× 41`）。
 * 幅 16px 以上の GB1 ベタを置かないこと（天井 OB-04 と誤認される）。
 */
export function drawHud(ctx: CanvasRenderingContext2D, s: RenderState): void {
  fillRect(ctx, TONE.HUD_BG, 0, 0, LOGICAL_W, 11)
  fillRect(ctx, TONE.HUD_RULE, 0, 11, LOGICAL_W, 1)

  // 離脱導線が出ている間は `ST nn` を描かない（重ねず差し替える）
  if (!drawExitPrompt(ctx, s)) {
    drawText(ctx, `ST ${pad2(s.hud.stageNo)}`, EXIT_LABEL_X, EXIT_LABEL_Y, {
      font: 'F3X5',
      tone: TONE.HUD_TEXT,
    })
  }
  drawProgressBar(ctx, s)

  const right = s.hud.practice ? 'PRACTICE' : `× ${s.hud.attempts}`
  drawText(ctx, right, 315, 3, {
    font: 'F3X5',
    tone: TONE.HUD_SUB_TEXT,
    align: 'right',
  })
}

/* ============================================================================
 * 死亡演出 と READY
 * ========================================================================== */

/** 到達率の表示時間 400ms = 24f */
const REACH_DISPLAY_FRAMES = 24

/**
 * 死亡時の到達率（400ms）。自己ベスト更新時は `NEW BEST 87.4%` に差し替える（600ms）。
 * 感嘆符は付けない。日本語は添えない（言葉は 1 回だけ）。
 */
export function drawDeathReadout(ctx: CanvasRenderingContext2D, d: RenderDeath): void {
  const limit = d.newBest ? 36 : REACH_DISPLAY_FRAMES // 600ms / 400ms
  if (d.frame >= limit) return
  const pct = formatPct(d.reachPct)
  const text = d.newBest ? `NEW BEST ${pct}` : pct
  drawText(ctx, text, LOGICAL_W / 2, 72, {
    font: 'F5X7',
    tone: TONE.TEXT_ON_SKY,
    scale: 2,
    align: 'center',
  })
}

/**
 * READY の 1 行。
 * 死亡メッセージは**左端から 8px・左揃え**、`TAP` は**右端から 8px・右揃え**、同一ベースライン。
 * 中央寄せでの並置は禁止（1 つの文に読めるため）。`TAP` だけが点滅する。
 */
export function drawReadyLine(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const baseY = 160
  if (s.readyMessage) {
    drawText(ctx, s.readyMessage, 8, baseY, {
      font: 'KANA',
      tone: TONE.TEXT_ON_GROUND_SUB,
    })
  }
  if (blink30(s.uiFrame)) {
    drawText(ctx, 'TAP', LOGICAL_W - 8, baseY, {
      font: 'F5X7',
      tone: TONE.TEXT_ON_GROUND,
      align: 'right',
    })
  }
  if (s.readyUnlock) {
    drawText(ctx, s.readyUnlock[0], LOGICAL_W / 2, 124, {
      font: 'F5X7',
      tone: TONE.TEXT_ON_SKY,
      align: 'center',
    })
    drawText(ctx, s.readyUnlock[1], LOGICAL_W / 2, 134, {
      font: 'F5X7',
      tone: TONE.TEXT_ON_SKY,
      align: 'center',
    })
  }
}

/** `STAGE 1` / `GO!` / `PRACTICE` の一時表示 */
export function drawBanner(ctx: CanvasRenderingContext2D, text: string): void {
  drawText(ctx, text, LOGICAL_W / 2, 72, {
    font: 'F5X7',
    tone: TONE.TEXT_ON_SKY,
    scale: 2,
    align: 'center',
  })
}

/* ============================================================================
 * 画面: PLAY / READY / HITSTOP / BURST
 * ========================================================================== */

export function drawPlayScreen(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const cam = Math.round(s.cameraX)
  drawSky(ctx, 12)
  drawGround(ctx, cam, s.stage)
  drawSpearGroundBreaks(ctx, s, cam)
  for (const ob of s.obstacles) drawObstacle(ctx, s, ob, cam)
  drawPlayer(ctx, s)
  drawChunks(ctx, s)
  drawHud(ctx, s)
  if (s.death) drawDeathReadout(ctx, s.death)
  else if (s.banner) drawBanner(ctx, s.banner.text)
  if (s.phase === 'READY') drawReadyLine(ctx, s)
}

/* ============================================================================
 * 画面: TITLE
 * ========================================================================== */

export function drawTitleScreen(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const t = s.title
  drawSky(ctx, 0)
  drawGround(ctx, 0, s.stage)

  // ロゴ（本作で唯一 GB2 の右下 1px 影を許可。ただし本モジュールでは影なしの単色で焼く）
  drawSprite(ctx, 'LOGO_JUMP', 114, 26)
  drawSprite(ctx, 'LOGO_OR', 149, 54)
  drawSprite(ctx, 'LOGO_DIE', 126, 70)

  drawText(ctx, 'とぶか、しぬか。', LOGICAL_W / 2, 100, {
    font: 'KANA',
    tone: TONE.TEXT_ON_SKY_SUB,
    align: 'center',
  })

  if (blink30(s.uiFrame)) {
    drawText(ctx, 'TAP TO START', LOGICAL_W / 2, 120, {
      font: 'F5X7',
      tone: TONE.TEXT_ON_SKY,
      align: 'center',
    })
  }
  if (!s.touchDevice) {
    drawText(ctx, 'SPACE / CLICK', LOGICAL_W / 2, 130, {
      font: 'F3X5',
      tone: TONE.TEXT_ON_SKY_SUB,
      align: 'center',
    })
  }

  drawPlayer(ctx, s)

  // ステージセレクトへの導線（枠 GB4 1px）
  strokeRect1(ctx, TONE.TEXT_ON_GROUND, 264, 154, 48, 11)
  drawText(ctx, 'STAGES', 288, 156, {
    font: 'F5X7',
    tone: TONE.TEXT_ON_GROUND,
    align: 'center',
  })

  drawText(ctx, `SFX ${t?.sfxOn ? 'ON' : 'OFF'}`, 8, 170, {
    font: 'F3X5',
    tone: TONE.TEXT_ON_GROUND,
  })
  drawText(ctx, `FLASH ${t?.flashOn ? 'ON' : 'OFF'}`, LOGICAL_W - 8, 170, {
    font: 'F3X5',
    tone: TONE.TEXT_ON_GROUND,
    align: 'right',
  })
  if (t && t.totalDeaths > 0) {
    drawText(ctx, `DEATHS ${t.totalDeaths}`, LOGICAL_W / 2, 170, {
      font: 'F3X5',
      tone: TONE.TEXT_ON_GROUND_SUB,
      align: 'center',
    })
  }
}

/* ============================================================================
 * 画面: STAGE SELECT
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 * 戻り導線 `TITLE`（采配裁定 M-2 / 2026-09-21）
 *
 * UIテキスト §11-1 の指定に従い、`←` アイコンではなく **`TITLE` の文字列**で描く。
 * 行き先を名指しするほうが記号より情報量が上であること、および
 * **`←` は離脱導線（`← STAGES`）の専用マーカーとして温存する**ことが理由。
 * セレクト → タイトルは通常の画面遷移、離脱導線はプレイの中断であり、矢印は後者を指す。
 * -------------------------------------------------------------------------- */

/** 文言（半角5）。最小サイズ＝FONT_3x5、薄色＝GB4 の空の上なので GB2（5.67:1） */
export const SELECT_BACK_TEXT = 'TITLE'
/** 描画起点。従来の `←` アイコンと同じ左上。実寸 20×5px（x8–27 / y8–12） */
export const SELECT_BACK_X = 4
export const SELECT_BACK_Y = 5

/**
 * 戻り導線のタップ判定（キャンバス左上起点・論理 px）。**描画より広い。**
 * 文字は 20×5px しかなく指では押せないため、離脱導線と同じ考え方で
 * どの `scale` でも 44×44 CSS px 以上を確保する。
 * **この矩形には一切描画しない**（枠線・背景・ハイライトを描かない）。
 * 枠は y56 から始まるので、最大高（scale 1 の 44px）でもカードと重ならない。
 */
export function selectBackTapRegion(scale: number): { x: number; y: number; w: number; h: number } {
  return { x: 0, y: 0, w: 56, h: Math.max(16, Math.ceil(44 / Math.max(1, scale))) }
}

const CARD_W = 88
const CARD_H = 72
/** 枠の左端 3 列。16 + 88×3 + 12×2 = 304（右マージン 16） */
const CARD_X: readonly number[] = [16, 116, 216]
/** 枠の上端 2 行。**5 枠を 3 + 2 の二行組**に並べる（6 枠目が必ず空く） */
const CARD_Y: readonly number[] = [24, 104]

/** 章タブ（GDD §15-9-2 / 指示書 §7A-6）。各 48 × 14 */
export const TAB_W = 48
export const TAB_H = 14
const TAB_X0 = 32
const TAB_Y = 0

/** 章のローマ数字。タブのラベルはこれだけ（章名は入れない） */
export const CHAPTER_NUMERALS: readonly string[] = ['I', 'II', 'III', 'IV', 'V', 'VI']
/**
 * 章名。**タブには入れず、選択中の章の集計見出しに 1 回だけ**出す。
 * タブの役割は切替であって説明ではなく、6 つすべてに名前を入れると常時 6 語が並ぶ。
 * そして選択中の章名は集計に出るので、**同じ語が画面に 2 回出る**ことになる。
 */
export const CHAPTER_NAMES: readonly string[] = [
  'GROUND',
  'AIR',
  'MOTION',
  'HEIGHT',
  'TRAPS',
  'ALL',
]

/** 章タブの矩形（論理 px）。タップ判定にも使えるようエンジン側へ公開する */
export function chapterTabRect(index: number): { x: number; y: number; w: number; h: number } {
  return { x: TAB_X0 + index * TAB_W, y: TAB_Y, w: TAB_W, h: TAB_H }
}

/** ステージ枠の矩形（論理 px）。index 0–4 が 3 + 2 の並び、index 5 は章集計の枠 */
export function selectCardRect(index: number): { x: number; y: number; w: number; h: number } {
  return {
    x: CARD_X[index % 3],
    y: CARD_Y[Math.floor(index / 3)],
    w: CARD_W,
    h: CARD_H,
  }
}

/**
 * 枠内でのステージ名の行組み。
 * **1 行で収まるならそのまま、収まらなければ最初の半角スペースで 2 行に割る。**
 * 全 30 本を実測したところ最長は半角 11（`FIRST WINGS` / `HIGH GROUND` / `FIRST SPEAR` /
 * `JUMP OR DIE`）＝ 44px で、88px 枠には**すべて 1 行で収まる**。
 * 2 行組は将来名前が伸びたときの保険として残してある。
 */
export function stageNameLines(name: string, maxWidth = CARD_W - 8): readonly string[] {
  if (measureText(name, 'F3X5') <= maxWidth) return [name]
  const at = name.indexOf(' ')
  if (at < 0) return [name]
  return [name.slice(0, at), name.slice(at + 1)]
}

/**
 * ステージ枠 88×72。
 *
 * 未解放枠は「文字を暗くする」のではなく **「地を暗くする」**（スタイルガイド §6-2 改訂 R5）。
 * 枠内を GB2 のベタで塗り、番号と錠を GB3（3.01:1）で置く。
 * **罫線は描かない**（ベタの外形が境界そのもの）。**ステージ名・到達率も出さない。**
 */
function drawSelectCard(
  ctx: CanvasRenderingContext2D,
  entry: RenderSelectEntry,
  x: number,
  y: number,
): void {
  const cx = x + CARD_W / 2

  if (entry.state === 'LOCKED') {
    fillRect(ctx, 2, x, y, CARD_W, CARD_H) // 地を GB2 のベタで塗る＝「入れない」の記号
    drawText(ctx, pad2(entry.no), cx, y + 8, { font: 'F5X7', tone: 3, scale: 2, align: 'center' })
    drawSprite(ctx, 'LOCK', cx - 4, y + 48) // SP-16 は GB3。必ず GB2 のベタ地の上に置く
    return
  }

  strokeRect1(ctx, 2, x, y, CARD_W, CARD_H)
  drawText(ctx, pad2(entry.no), cx, y + 8, { font: 'F5X7', tone: 1, scale: 2, align: 'center' })

  const lines = stageNameLines(entry.name)
  lines.forEach((line, i) => {
    drawText(ctx, line, cx, y + 30 + i * 8, { font: 'F3X5', tone: 2, align: 'center' })
  })

  // 未クリアは **完全な空欄**。輪郭だけの星（器）を置かない（UIテキスト 11-2）
  if (entry.state === 'CLEARED') drawSprite(ctx, 'STAR_FULL', cx - 4, y + 48)

  const record =
    entry.state === 'CLEARED' && entry.bestTimeMs != null
      ? formatTime(entry.bestTimeMs)
      : entry.bestPct != null
        ? formatPct(entry.bestPct)
        : '--'
  drawText(ctx, record, x + CARD_W - 4, y + 62, { font: 'F3X5', tone: 2, align: 'right' })
}

/**
 * 章タブ 6 個。ラベルは `I`〜`VI` のローマ数字のみ。
 *
 * | 状態 | 地 | 文字 | 比 |
 * |---|---|---|---|
 * | 選択中 | GB2 ベタ | GB4 | 5.67:1 |
 * | 未選択（解放済） | GB4（空のまま） | GB2 | 5.67:1 |
 * | 未解放 | GB2 ベタ | GB3 | 3.01:1（R11 の未解放枠と同じ作法） |
 */
export function drawChapterTabs(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const sel = s.select
  if (!sel) return
  for (let i = 0; i < CHAPTER_COUNT; i++) {
    const r = chapterTabRect(i)
    const unlocked = sel.chapterUnlocked?.[i] ?? false
    const selected = i === sel.chapter
    let tone: Tone = 2
    if (selected || !unlocked) {
      // 地のベタは **右端 1px を空けて** 塗る。選択中（地GB2）と未解放（地GB2）が
      // 隣り合うと 1 本の帯に見えてタブの境目が消えるため、空（GB4）の 1px で切る。
      // 階調は増やしていない。タップ判定の矩形（chapterTabRect）は 48px のまま。
      fillRect(ctx, 2, r.x, r.y, r.w - 1, r.h)
      tone = selected ? 4 : 3
    }
    drawText(ctx, CHAPTER_NUMERALS[i], r.x + (r.w - 1) / 2, r.y + 4, {
      font: 'F5X7',
      tone,
      align: 'center',
    })
  }
}

/**
 * 章の集計。**3 + 2 に並べたとき必ず空く 6 枠目**に入れるので、行を 1 本も増やさない。
 *
 * ```
 *  III MOTION      3/5
 *  DEATHS          412
 * ```
 * **章の総タイムは出さない。** 放置していても増えるので、投じた努力を表さない。
 * 未プレイの章も同じ形式（`0/5` / `DEATHS 0`）。`--` は使わない。走っていれば 0 は測定値である。
 */
export function drawChapterSummary(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const sel = s.select
  if (!sel) return
  const r = selectCardRect(5)
  const left = r.x + 4
  const right = r.x + CARD_W - 4
  const ch = Math.max(0, Math.min(CHAPTER_COUNT - 1, sel.chapter ?? 0))

  drawText(ctx, `${CHAPTER_NUMERALS[ch]} ${CHAPTER_NAMES[ch]}`, left, r.y + 30, {
    font: 'F3X5',
    tone: 2,
  })
  drawText(ctx, `${sel.clearedInChapter ?? 0}/${STAGES_PER_CHAPTER}`, right, r.y + 30, {
    font: 'F3X5',
    tone: 2,
    align: 'right',
  })
  drawText(ctx, 'DEATHS', left, r.y + 40, { font: 'F3X5', tone: 2 })
  drawText(ctx, `${sel.deathsInChapter ?? 0}`, right, r.y + 40, {
    font: 'F3X5',
    tone: 2,
    align: 'right',
  })

  if (sel.showPracticeHint) {
    drawText(ctx, 'HOLD = PRACTICE', r.x + CARD_W / 2, r.y + 58, {
      font: 'F3X5',
      tone: 2,
      align: 'center',
    })
  }
}

export function drawSelectScreen(ctx: CanvasRenderingContext2D, s: RenderState): void {
  // 地は全面 GB4（30 本対応で地面は描かない。y0–15 タブ / 枠 2 行 / 6 枠目が章集計）
  fillRect(ctx, TONE.SKY, 0, 0, LOGICAL_W, LOGICAL_H)

  drawText(ctx, SELECT_BACK_TEXT, SELECT_BACK_X, SELECT_BACK_Y, {
    font: 'F3X5',
    tone: TONE.TEXT_ON_SKY_SUB,
  })
  drawChapterTabs(ctx, s)

  const entries = s.select?.entries ?? []
  entries.slice(0, STAGES_PER_CHAPTER).forEach((e, i) => {
    const r = selectCardRect(i)
    drawSelectCard(ctx, e, r.x, r.y)
  })

  drawChapterSummary(ctx, s)
}

/** 値を階調反転で表示する（地を GB1 で敷き、文字を GB4 で置く）。6f ごと × 5 回 = 600ms */
function drawInvertedValue(
  ctx: CanvasRenderingContext2D,
  text: string,
  rightX: number,
  y: number,
  font: FontId,
): void {
  const w = measureText(text, font)
  fillRect(ctx, 1, rightX - w - 1, y - 1, w + 2, 9)
  drawText(ctx, text, rightX, y, { font, tone: 4, align: 'right' })
}

export function drawResultScreen(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const r = s.result
  drawSky(ctx, 0)
  drawGround(ctx, 0, s.stage)
  if (!r) return

  const heading = r.allClear ? 'ALL CLEAR' : r.firstClear ? 'FIRST CLEAR' : 'STAGE CLEAR'
  drawText(ctx, heading, LOGICAL_W / 2, 40, {
    font: 'F5X7',
    tone: TONE.TEXT_ON_SKY,
    scale: 2,
    align: 'center',
  })
  const sub = r.allClear ? 'ぜんぶ おぼえた。' : r.firstClear ? 'ついに。' : 'こえた。'
  drawText(ctx, sub, LOGICAL_W / 2, 60, {
    font: 'KANA',
    tone: TONE.TEXT_ON_SKY_SUB,
    align: 'center',
  })

  // 記録（ラベル左揃え x96 / 値右揃え x224）
  const timeLabel = r.newRecord ? 'NEW RECORD' : 'TIME'
  drawText(ctx, timeLabel, 96, 84, { font: 'F5X7', tone: TONE.TEXT_ON_SKY })
  const timeText = formatTime(r.timeMs)
  if (r.newRecord && Math.floor(s.uiFrame / 6) % 2 === 0) {
    drawInvertedValue(ctx, timeText, 224, 84, 'F5X7')
  } else {
    drawText(ctx, timeText, 224, 84, { font: 'F5X7', tone: TONE.TEXT_ON_SKY, align: 'right' })
  }

  drawText(ctx, 'DEATHS', 96, 96, { font: 'F5X7', tone: TONE.TEXT_ON_SKY })
  drawText(ctx, `${r.deaths}`, 224, 96, {
    font: 'F5X7',
    tone: TONE.TEXT_ON_SKY,
    align: 'right',
  })

  // 解放通知は 2 行に割る（1 行に繋げると半角 17 文字で安全域を超える）
  if (r.unlockedStageNo != null && !r.allClear) {
    drawText(ctx, `STAGE ${pad2(r.unlockedStageNo)}`, LOGICAL_W / 2, 110, {
      font: 'F5X7',
      tone: TONE.TEXT_ON_SKY,
      align: 'center',
    })
    drawText(ctx, 'UNLOCKED', LOGICAL_W / 2, 120, {
      font: 'F5X7',
      tone: TONE.TEXT_ON_SKY,
      align: 'center',
    })
  }

  if (blink30(s.uiFrame)) {
    drawText(ctx, 'NEXT', LOGICAL_W / 2, 140, {
      font: 'F5X7',
      tone: TONE.TEXT_ON_SKY,
      align: 'center',
    })
  }

  drawText(ctx, 'RETRY', 8, 168, { font: 'F3X5', tone: TONE.TEXT_ON_GROUND })
  drawText(ctx, 'STAGES', LOGICAL_W - 8, 168, {
    font: 'F3X5',
    tone: TONE.TEXT_ON_GROUND_SUB,
    align: 'right',
  })
}

/* ============================================================================
 * エントリポイント
 * ========================================================================== */

/**
 * 1 フレームを描く。**320×180 のオフスクリーン canvas に対して呼ぶこと。**
 * 呼ぶ前に `initRender()` を 1 度だけ済ませておく。
 */
export function drawFrame(ctx: CanvasRenderingContext2D, s: RenderState): void {
  ctx.imageSmoothingEnabled = false
  switch (s.phase) {
    case 'TITLE':
      drawTitleScreen(ctx, s)
      break
    case 'SELECT':
      drawSelectScreen(ctx, s)
      break
    case 'RESULT':
      drawResultScreen(ctx, s)
      break
    default:
      drawPlayScreen(ctx, s)
      break
  }
}
