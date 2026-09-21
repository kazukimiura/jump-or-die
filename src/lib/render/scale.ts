/**
 * scale.ts — 整数倍スケーリングと canvas の初期設定
 *
 * 出典: GDD §11-1 / §12-3、スタイルガイド §8
 *
 * 絶対制約:
 *   - 論理解像度 320 × 180 固定。端末で変えない【P0】
 *   - 整数倍スケールのみ。非整数倍は禁止
 *   - `imageSmoothingEnabled = false` を **canvas のサイズを変更するたびに** 再設定する
 *   - 小数座標に物を置かない（描画直前に Math.round）
 *
 * React に依存しない純粋な TypeScript モジュール。
 */

/** 論理解像度 幅（固定） */
export const LOGICAL_W = 320
/** 論理解像度 高さ（固定） */
export const LOGICAL_H = 180

/** HUD 帯 y 0–11（12px） */
export const HUD_BAND_H = 12
/** 地面上面 y（groundY） */
export const GROUND_Y = 148
/** プレイヤー固定 X */
export const PLAYER_X = 56

/** 整数倍スケールの上限（スタイルガイド §8-3） */
export const MAX_SCALE = 6

/** 2D コンテキストの最小インターフェース。描画層はこれ以上の API を使わない */
export type Ctx2D = CanvasRenderingContext2D

/**
 * 320×180 のオフスクリーン canvas を作る。全描画はここに対して行う。
 * SSR（静的エクスポートのビルド時）に評価されないよう、**モジュール直下で呼ばないこと**。
 */
export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  if (g) g.imageSmoothingEnabled = false
  return cv
}

/** 論理解像度のオフスクリーン canvas */
export function createOffscreen(): HTMLCanvasElement {
  return createCanvas(LOGICAL_W, LOGICAL_H)
}

/**
 * 整数倍スケールを求める。
 * `scale = clamp(floor(min(vw / 320, vhAvail / 180)), 1, 6)`
 */
export function computeScale(vw: number, vhAvail: number): number {
  const raw = Math.floor(Math.min(vw / LOGICAL_W, vhAvail / LOGICAL_H))
  return Math.max(1, Math.min(MAX_SCALE, raw))
}

/** devicePixelRatio を整数へ丸める（端末による粒の不均一を潰す。GDD §12-3） */
export function integerDpr(dpr: number): number {
  return Math.max(1, Math.floor(dpr))
}

export interface MainCanvasSetup {
  ctx: Ctx2D
  /** backing store の幅（= 320 * scale * dprI） */
  backingW: number
  /** backing store の高さ（= 180 * scale * dprI） */
  backingH: number
  scale: number
  dprI: number
}

/**
 * メイン canvas を整数倍で構成する。
 * CSS サイズ = 320*scale × 180*scale、backing store = さらに整数 dpr 倍。
 * **サイズ変更のたびに imageSmoothingEnabled を再設定する。**
 */
export function configureMainCanvas(
  canvas: HTMLCanvasElement,
  scale: number,
  dpr: number,
): MainCanvasSetup {
  const dprI = integerDpr(dpr)
  const cssW = LOGICAL_W * scale
  const cssH = LOGICAL_H * scale
  const backingW = cssW * dprI
  const backingH = cssH * dprI

  canvas.width = backingW
  canvas.height = backingH
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  canvas.style.imageRendering = 'pixelated'
  // Safari 系のための併記。CSSStyleDeclaration の型にないので setProperty を使う
  canvas.style.setProperty('image-rendering', '-webkit-optimize-contrast')
  canvas.style.setProperty('image-rendering', 'pixelated')

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  // サイズ変更で設定がリセットされる実装があるため、ここで必ず再設定する
  ctx.imageSmoothingEnabled = false

  return { ctx, backingW, backingH, scale, dprI }
}

/** オフスクリーンの 320×180 をメイン canvas へ整数倍で転送する */
export function present(setup: MainCanvasSetup, off: HTMLCanvasElement): void {
  const { ctx, backingW, backingH } = setup
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(off, 0, 0, LOGICAL_W, LOGICAL_H, 0, 0, backingW, backingH)
}

/**
 * レターボックス（canvas 外の余白）の色。枠飾りは付けない。
 * ゲームコンテナの背景色に使う（スタイルガイド §8-3）。
 */
export const LETTERBOX_COLOR = '#081820'

/** 描画座標を整数へ丸める。**描画直前に必ず通すこと** */
export function px(v: number): number {
  return Math.round(v)
}
