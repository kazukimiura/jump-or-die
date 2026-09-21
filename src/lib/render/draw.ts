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
import { drawText, measureText, initFont, assertFonts, type FontId } from './font'
import {
  drawSprite,
  drawSpritePart,
  initSprites,
  assertSprites,
  type SpriteName,
} from './sprites'
import { LOGICAL_H, LOGICAL_W, PLAYER_X } from './scale'
import type {
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

const GROUND_TILES: readonly SpriteName[] = ['GROUND_A', 'GROUND_B', 'GROUND_C']

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
  const tile = GROUND_TILES[stage.tilePattern] ?? 'GROUND_A'
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
export function drawBlockS(ctx: CanvasRenderingContext2D, x: number, y: number, inv = false): void {
  drawSprite(ctx, 'BLOCK_S', x, y, inv)
}

/** OB-02 ブロック大 24×32。OB-01 と意図的に同じ見た目 */
export function drawBlockL(ctx: CanvasRenderingContext2D, x: number, y: number, inv = false): void {
  drawSprite(ctx, 'BLOCK_L', x, y, inv)
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
  inv = false,
): void {
  for (let dy = 0; dy < h; dy += 16) {
    const sh = Math.min(16, h - dy)
    for (let dx = 0; dx < w; dx += 16) {
      const sw = Math.min(16, w - dx)
      drawSpritePart(ctx, 'CEILING', 0, 0, sw, sh, x + dx, y + dy, inv)
    }
  }
}

/** OB-05 浮遊足場。32×8 を 3 スライス（左8 / 中16反復 / 右8）で任意幅に伸ばす */
export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  inv = false,
): void {
  const edge = 8
  if (w <= edge * 2) {
    drawSpritePart(ctx, 'PLATFORM', 0, 0, w, 8, x, y, inv)
    return
  }
  drawSpritePart(ctx, 'PLATFORM', 0, 0, edge, 8, x, y, inv)
  let dx = edge
  const midW = w - edge * 2
  while (dx < edge + midW) {
    const sw = Math.min(16, edge + midW - dx)
    drawSpritePart(ctx, 'PLATFORM', 8, 0, sw, 8, x + dx, y, inv)
    dx += sw
  }
  drawSpritePart(ctx, 'PLATFORM', 32 - edge, 0, edge, 8, x + w - edge, y, inv)
}

/** OB-06 トゲ。8×8 を隙間なく並べ、束として 1 つの障害物に見せる */
export function drawSpike(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  inv = false,
): void {
  for (let dx = 0; dx < w; dx += 8) {
    drawSpritePart(ctx, 'SPIKE', 0, 0, Math.min(8, w - dx), 8, x + dx, y, inv)
  }
}

/** OB-07 昇降ブロック 16×16。見た目は OB-01 と同じ。動いていること自体が識別情報 */
export function drawLifter(ctx: CanvasRenderingContext2D, x: number, y: number, inv = false): void {
  drawSprite(ctx, 'LIFTER', x, y, inv)
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
  inv = false,
  frameOverride?: number,
): void {
  const f = frameOverride ?? Math.floor(stageFrame / 6) % 2
  drawSprite(ctx, f === 0 ? 'FLYER_A' : 'FLYER_B', x, y, inv)
}

/** OB-09 崩落床 24×8・3 コマ（無傷 / ひび1 / ひび3）。ひびは GB4 で「空が透けて見える」 */
export function drawCrumble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  frame: number,
  inv = false,
): void {
  const name: SpriteName = frame >= 2 ? 'CRUMBLE_2' : frame === 1 ? 'CRUMBLE_1' : 'CRUMBLE_0'
  for (let dx = 0; dx < w; dx += 24) {
    drawSpritePart(ctx, name, 0, 0, Math.min(24, w - dx), 8, x + dx, y, inv)
  }
}

/** OB-10 バネ 12×8 /12×16・2 コマ。伸びコマは台座を地面に固定したまま上へ伸びる */
export function drawSpring(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottomY: number,
  frame: number,
  inv = false,
): void {
  const name: SpriteName = frame === 1 ? 'SPRING_B' : 'SPRING_A'
  const h = frame === 1 ? 16 : 8
  drawSprite(ctx, name, x, bottomY - h, inv)
}

/** 殺した障害物 1 個だけを階調反転して点滅させるか（3f ON / 3f OFF・画面全体のフラッシュは禁止） */
function killerInverted(s: RenderState, id: number): boolean {
  const d = s.death
  if (!d || d.killerId !== id || s.reducedFlash) return false
  return d.frame < 6 && d.frame % 6 < 3
}

/** `reducedFlash` 時の代替表示: 殺した障害物の外周 1px を GB4 で縁取る静止表示（6f 間） */
function killerOutlined(s: RenderState, id: number): boolean {
  const d = s.death
  if (!d || d.killerId !== id || !s.reducedFlash) return false
  return d.frame < 6
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
  const inv = killerInverted(s, ob.id)

  switch (ob.kind) {
    case 'BLOCK_S':
      drawBlockS(ctx, x, ob.y, inv)
      break
    case 'BLOCK_L':
      drawBlockL(ctx, x, ob.y, inv)
      break
    case 'PIT':
      drawPit()
      break
    case 'CEILING':
      drawCeiling(ctx, x, ob.y, ob.w, ob.h, inv)
      break
    case 'PLATFORM':
      drawPlatform(ctx, x, ob.y, ob.w, inv)
      break
    case 'SPIKE':
      drawSpike(ctx, x, ob.y, ob.w, inv)
      break
    case 'LIFTER':
      drawLifter(ctx, x, ob.y, inv)
      break
    case 'FLYER':
      drawFlyer(ctx, x, ob.y, s.stageFrame, inv, ob.frame)
      break
    case 'CRUMBLE':
      drawCrumble(ctx, x, ob.y, ob.w, ob.frame ?? 0, inv)
      break
    case 'SPRING':
      drawSpring(ctx, x, ob.y + ob.h, ob.frame ?? 0, inv)
      break
  }

  if (killerOutlined(s, ob.id)) {
    // 外周 1px を GB4 で縁取る。ただし **1px 内側に入れる**。
    // 空も GB4 なので、外側や最外周に置くと背景に溶けて何も見えない。
    // 1px 内側なら GB1 → GB4 → GB1 となり、15.9:1 の輪が黒の中に浮く。
    strokeRect1(ctx, 4, x + 1, ob.y + 1, ob.w - 2, ob.h - 2)
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

  drawText(ctx, `ST ${pad2(s.hud.stageNo)}`, 4, 3, { font: 'F3X5', tone: TONE.HUD_TEXT })
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

const CARD_W = 88
const CARD_H = 72
const CARD_Y = 56
const CARD_X: readonly number[] = [16, 116, 216]

function drawSelectCard(
  ctx: CanvasRenderingContext2D,
  entry: RenderSelectEntry,
  x: number,
): void {
  const locked = entry.state === 'LOCKED'
  const frameTone: Tone = locked ? 3 : 2
  strokeRect1(ctx, frameTone, x, CARD_Y, CARD_W, CARD_H)

  const cx = x + CARD_W / 2
  drawText(ctx, pad2(entry.no), cx, 64, {
    font: 'F5X7',
    tone: locked ? 3 : 1,
    scale: 2,
    align: 'center',
  })

  if (!locked) {
    // ステージ名は最大 2 行。半角スペースで折る
    const words = entry.name.split(' ')
    const lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : [entry.name]
    lines.forEach((line, i) => {
      drawText(ctx, line, cx, 86 + i * 8, { font: 'F3X5', tone: 2, align: 'center' })
    })
  }

  if (locked) {
    drawSprite(ctx, 'LOCK', cx - 4, 104)
  } else if (entry.state === 'CLEARED') {
    // 未クリアは **完全な空欄**。輪郭だけの星（器）を置かない（UIテキスト 11-2）
    drawSprite(ctx, 'STAR_FULL', cx - 4, 104)
  }

  if (!locked) {
    const record =
      entry.state === 'CLEARED' && entry.bestTimeMs != null
        ? formatTime(entry.bestTimeMs)
        : entry.bestPct != null
          ? formatPct(entry.bestPct)
          : '--'
    drawText(ctx, record, x + CARD_W - 4, 118, { font: 'F3X5', tone: 2, align: 'right' })
  }
}

export function drawSelectScreen(ctx: CanvasRenderingContext2D, s: RenderState): void {
  drawSky(ctx, 0)
  drawGround(ctx, 0, s.stage)

  drawSprite(ctx, 'ARROW', 8, 8)
  drawText(ctx, 'STAGE SELECT', LOGICAL_W / 2, 20, {
    font: 'F3X5',
    tone: TONE.TEXT_ON_SKY_SUB,
    align: 'center',
  })

  const entries = s.select?.entries ?? []
  entries.slice(0, CARD_X.length).forEach((e, i) => drawSelectCard(ctx, e, CARD_X[i]))

  if (s.select?.showPracticeHint) {
    drawText(ctx, 'HOLD = PRACTICE', LOGICAL_W / 2, 170, {
      font: 'F3X5',
      tone: TONE.TEXT_ON_GROUND_SUB,
      align: 'center',
    })
  }
}

/* ============================================================================
 * 画面: RESULT（ステージクリア時のみ）
 * ========================================================================== */

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
