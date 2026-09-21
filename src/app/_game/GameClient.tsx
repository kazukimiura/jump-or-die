'use client'

/**
 * GameClient.tsx — canvas のマウントと固定タイムステップのループ
 *
 * 出典: GDD §3-1（入力パイプライン）/ §11-1（整数倍スケール）/ §12-1（描画ループ）
 *       / §12-2（React の使いどころ）/ §12-3（ピクセルパーフェクト）/ §12-4 / §12-5
 *
 * 【React の扱い — GDD §12-2 の要件】
 * 本コンポーネントは **マウント時に1回だけレンダリングされ、以後一切再レンダリングしない**。
 * state / ref の更新でツリーを走らせないよう、可変状態はすべて `app.ts` の
 * プレーンオブジェクトに置き、ループは `useEffect` 内の `requestAnimationFrame` で回す。
 * HUD の数値・画面遷移も含めてすべて canvas に描くため、DOM を更新する必要が無い。
 *
 * 【入力 — 憲法4】
 * `pointerdown` / `keydown` のみ。`click` / `touchend` は使わない。
 * ハンドラがするのは**キューに積むこと**だけで、state 更新も描画もしない。
 * 取り込み → 固定ステップ更新 → 描画 を同一 rAF ティックで行うため、
 * タップから画面反映までは最大 1 ティック（16.7ms）に収まる。
 */

import { useEffect, useRef } from 'react'
import { drawFrame, initRender } from '@/lib/render/draw'
import {
  LOGICAL_H,
  LOGICAL_W,
  computeScale,
  configureMainCanvas,
  createOffscreen,
  present,
  type MainCanvasSetup,
} from '@/lib/render/scale'
import {
  advanceFrame,
  buildRenderState,
  createApp,
  queueKey,
  queueTap,
  setHidden,
  setViewScale,
  takeSfx,
  type App,
} from './app'
import { Sfx } from './sfx'

/** 固定タイムステップ 16.6667ms（GDD §12-1） */
const FIXED_MS = 1000 / 60
/** アキュムレータの上限。超えたぶんは**進めずに捨てる**（spiral of death を避ける） */
const MAX_ACC_MS = 100
/** 1 フレームあたりの最大ステップ数 */
const MAX_STEPS = 5

/** ジャンプに割り当てるキー（GDD §12-4）。`e.repeat` は破棄する */
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyZ'])

export default function GameClient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    initRender()

    /*
     * プレイ領域をブラウザの **トップレイヤー** へ載せる（GDD §12-5 / 検査 C-1）。
     *
     * AdSense のアンカー広告は z-index 2147483647 で挿入されるため、CSS の z-index を
     * 最大値まで上げても「同値なら後から挿入された側が上」になり、覆える保証が無い。
     * `popover="manual"` の要素はトップレイヤーに載り、**z-index と DOM 順の外側**で
     * 常に最前面になるので、挿入順に依存せず確実に覆える。
     *
     * - 広告要素は削除も非表示もしない（AdSense ポリシー順守）。覆うだけ
     * - `manual` は Esc・領域外タップで閉じない。離脱導線の Esc と競合しない
     * - 非対応ブラウザでは属性を付けず、CSS の z-index にフォールバックする
     *   （`[popover]:not(:popover-open)` の UA 既定で消えるのを避けるため、
     *     showPopover に成功したときだけ属性を残す）
     */
    const root = canvas.parentElement
    if (root && typeof (root as HTMLElement).showPopover === 'function') {
      try {
        root.setAttribute('popover', 'manual')
        ;(root as HTMLElement).showPopover()
      } catch {
        root.removeAttribute('popover')
      }
    }

    const off = createOffscreen()
    const offCtx = off.getContext('2d')
    if (!offCtx) return
    offCtx.imageSmoothingEnabled = false

    const touchDevice =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ?? false)

    let storage: Storage | null = null
    try {
      storage = window.localStorage
    } catch {
      storage = null // プライベートブラウズ等。記録は揮発するがゲームは動く
    }

    const app: App = createApp({
      storage,
      now: () => Date.now(), // クリアタイムの計測にのみ使う（GDD §12-6）
      random: () => Math.random(), // 死亡メッセージの抽選にのみ使う（演出）
      touchDevice,
    })
    const sfx = new Sfx()

    let setup: MainCanvasSetup = configureMainCanvas(
      canvas,
      computeScale(window.innerWidth, window.innerHeight),
      window.devicePixelRatio || 1,
    )
    setViewScale(app, setup.scale)

    const resize = () => {
      setup = configureMainCanvas(
        canvas,
        computeScale(window.innerWidth, window.innerHeight),
        window.devicePixelRatio || 1,
      )
      // 離脱導線のタップ判定を 44 CSS px 以上に保つための換算（GDD §14-16-3）
      setViewScale(app, setup.scale)
    }

    /** クライアント座標 → 論理座標（320×180）。canvas 外の余白は汎用タップ扱い */
    const toLogical = (clientX: number, clientY: number): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect()
      const s = setup.scale
      const x = (clientX - r.left) / s
      const y = (clientY - r.top) / s
      if (x < 0 || y < 0 || x >= LOGICAL_W || y >= LOGICAL_H) {
        // レターボックス上のタップ。ボタンには当てず、汎用タップとして扱う（GDD §11-1）
        return { x: LOGICAL_W / 2, y: 4 }
      }
      return { x, y }
    }

    // --- 入力（フラグを積むだけ。O(1)） ------------------------------------
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      sfx.unlock() // 最初のユーザー操作で AudioContext.resume()
      const p = toLogical(e.clientX, e.clientY)
      queueTap(app, p.x, p.y)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Escape') {
        queueKey(app, 'Escape')
        return
      }
      if (!JUMP_KEYS.has(e.code)) return
      e.preventDefault() // Space のスクロールを止める
      sfx.unlock()
      queueKey(app, e.code)
    }
    const onVisibility = () => {
      setHidden(app, document.visibilityState === 'hidden')
      acc = 0
      last = performance.now()
    }
    const onContextMenu = (e: Event) => e.preventDefault()

    window.addEventListener('pointerdown', onPointerDown, { passive: false })
    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('contextmenu', onContextMenu)

    // --- ループ -------------------------------------------------------------
    let raf = 0
    let last = performance.now()
    let acc = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)

      // ② アキュムレータ更新（実 dt は 100ms で頭打ち）
      const dt = Math.min(now - last, MAX_ACC_MS)
      last = now
      acc += dt

      // ③ 固定ステップ更新（①入力取り込みは advanceFrame の先頭で行う）
      let steps = 0
      while (acc >= FIXED_MS && steps < MAX_STEPS) {
        advanceFrame(app)
        acc -= FIXED_MS
        steps++
      }
      if (steps >= MAX_STEPS) acc = 0 // まとめ処理で一気に進めない

      sfx.enabled = app.save.opt.sfx
      for (const kind of takeSfx(app)) sfx.play(kind)

      // ④ 描画（現在のシミュレーション状態をそのまま描く。補間しない）
      drawFrame(offCtx, buildRenderState(app))
      present(setup, off)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  // このツリーは**マウント時の1回しか描かれない**（依存が空・state を持たない）
  return (
    <div className="jd-root">
      <canvas ref={canvasRef} className="jd-canvas" aria-label="JUMP OR DIE" />
    </div>
  )
}
