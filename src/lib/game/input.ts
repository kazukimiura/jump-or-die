/**
 * JumpOrDie — 入力（受付・先行入力バッファ・コヨーテタイム）
 *
 * 出典: GDD §3（入力仕様）/ §12-4 / 憲法4（入力遅延は仕様である）
 *
 * 絶対制約:
 * - `click` / `touchend` を使わない。`pointerdown` / `keydown` のみ
 * - イベントハンドラ内では **フラグを立てるだけ**。state 更新・描画をしない
 * - React に依存しない。本ファイルは DOM しか触らない
 *
 * 入力パイプライン（GDD §3-1）:
 *   pointerdown -> tapPending = true              （O(1)）
 *   rAF 内:  ① 取り込み -> ② 固定ステップ更新 -> ③ 描画
 * ③ の直前に ② を回すことで、タップ→描画を最大 1 ティック（16.7ms）に抑える。
 */

import { COYOTE_TIME, INPUT_BUFFER } from './constants'
import type { PlayerPhysics } from './types'

// ---------------------------------------------------------------------------
// 入力の生受付（DOM 側）
// ---------------------------------------------------------------------------

/**
 * イベントハンドラが立てるフラグだけを持つ器。
 * ゲームループはフレーム頭で `takeTap()` を呼んで取り込む。
 */
export type InputSource = {
  /** 直近のフレームでタップがあったか */
  tapPending: boolean
}

export function createInputSource(): InputSource {
  return { tapPending: false }
}

/** ゲームループ側から1フレームに1度だけ呼ぶ。取り込んだらフラグを倒す */
export function takeTap(src: InputSource): boolean {
  const t = src.tapPending
  src.tapPending = false
  return t
}

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyZ'])

/**
 * `pointerdown` / `keydown` を購読する。戻り値を呼ぶと解除される。
 *
 * - `pointerdown` は `{ passive: false }` + `preventDefault()`（GDD §12-4）
 * - `keydown` は Space / ArrowUp / KeyZ。`e.repeat` は破棄
 * - ハンドラ内でやるのはフラグ設定のみ（憲法4）
 *
 * タップ判定領域はキャンバス外の余白も含めたビューポート全域とすること
 * （GDD §11-1）。そのため既定の target は `window` を想定する。
 */
export function attachInput(
  target: EventTarget,
  src: InputSource,
  keyTarget?: EventTarget,
): () => void {
  const onPointerDown = (e: Event) => {
    e.preventDefault()
    src.tapPending = true
  }
  const onKeyDown = (e: Event) => {
    const ke = e as KeyboardEvent
    if (ke.repeat) return
    if (!JUMP_KEYS.has(ke.code)) return
    // Space のスクロールを止める（GDD §12-4）
    e.preventDefault()
    src.tapPending = true
  }

  const keys = keyTarget ?? target
  target.addEventListener('pointerdown', onPointerDown, { passive: false })
  keys.addEventListener('keydown', onKeyDown, { passive: false } as AddEventListenerOptions)

  return () => {
    target.removeEventListener('pointerdown', onPointerDown)
    keys.removeEventListener('keydown', onKeyDown)
  }
}

// ---------------------------------------------------------------------------
// 先行入力バッファ / コヨーテタイム（シミュレーション側・純粋）
// ---------------------------------------------------------------------------

/** タップ未記録を表す番兵。負の大きな値でバッファ窓から必ず外れる */
export const NO_TAP = -1024

/**
 * 先行入力バッファ（GDD §3-2）。窓は 6 フレーム（100ms）。
 *
 * 救うのは「早すぎた入力」だけ。**遅すぎた入力は救わない**。
 * 現フレームでタップした場合も `frame - lastTapFrame = 0` で真になるため、
 * 接地中のタップは同一フレームで発火する。
 */
export function hasBufferedTap(stageFrame: number, lastTapFrame: number): boolean {
  return stageFrame - lastTapFrame <= INPUT_BUFFER && lastTapFrame > NO_TAP
}

/**
 * コヨーテタイム（GDD §3-3）。窓は 3 フレーム（50ms）。
 *
 * 効くのは「足場の縁から踏み外した」場合だけ。
 * 自分からジャンプして離陸した後（jumpedSinceGround）は対象外＝二段ジャンプにしない。
 */
export function inCoyoteTime(stageFrame: number, p: PlayerPhysics): boolean {
  if (p.jumpedSinceGround) return false
  return stageFrame - p.lastGroundedFrame <= COYOTE_TIME
}

/**
 * このフレームにジャンプを発火してよいか。
 * 接地中、またはコヨーテ猶予中のみ真（二段ジャンプは存在しない）。
 */
export function canJumpNow(stageFrame: number, p: PlayerPhysics): boolean {
  if (p.state === 'DEAD') return false
  if (p.state === 'GROUNDED') return true
  if (p.state === 'FALLING') return inCoyoteTime(stageFrame, p)
  return false
}
