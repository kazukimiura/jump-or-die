/**
 * JumpOrDie — 物理（重力・ジャンプ・速度の積分）
 *
 * 出典: GDD §2（ジャンプの物理設計）/ §12-1（固定タイムステップ）
 *
 * - 固定タイムステップ 1/60s のみ。可変 dt で回さない
 * - ホールド変調なし・二段ジャンプなし（GDD §2-4 / §3-4）
 * - 重力は上昇・下降で非対称にしない（GDD §2-5）
 * - 座標は float で保持し、丸めるのは描画時のみ（GDD §12-3）
 *
 * 【積分法について】
 * 台形則（速度Verlet相当）で積分する: y += (vy + vyNext) / 2, vy = vyNext。
 * 単純な前進オイラーだと離散化誤差で最大到達高さが 49.6px / 54.6px にずれ、
 * GDD 付録A の JUMP_APEX = 52.08 / JUMP_AIRTIME = 41.67 と一致しない。
 * 台形則は h(k) = V0*k - (G/2)*k^2 となり、頂点 = V0^2/(2G) = 52.08px、
 * 滞空 = 2*V0/G = 41.67f と **付録Aの値に厳密に一致**する。
 * 定数を丸めないための選択であり、定数そのものは一切変更していない。
 */

import {
  GRAVITY,
  JUMP_V0,
  SPEAR_HIT_W,
  PLAYER_FOOT_OX,
  PLAYER_FOOT_OY,
  PLAYER_FOOT_W,
  PLAYER_HITBOX_H,
  PLAYER_HITBOX_OX,
  PLAYER_HITBOX_OY,
  PLAYER_HITBOX_W,
  PLAYER_SPRITE_H,
  TERMINAL_VY,
} from './constants'
import type { PlayerPhysics, Rect } from './types'

/** 地面に立っている状態のスプライト y を返す（足が groundY に乗る） */
export function standingY(surfaceTop: number): number {
  return surfaceTop - PLAYER_SPRITE_H
}

/** 致死判定ボックス（GDD §4-2）。worldX はスプライト左上のワールドX */
export function lethalRect(worldX: number, y: number): Rect {
  return {
    x: worldX + PLAYER_HITBOX_OX,
    y: y + PLAYER_HITBOX_OY,
    w: PLAYER_HITBOX_W,
    h: PLAYER_HITBOX_H,
  }
}

/** 致死判定ボックスの下辺 y（GDD §4-4 の prevBottom） */
export function lethalBottom(y: number): number {
  return y + PLAYER_HITBOX_OY + PLAYER_HITBOX_H
}

/** 致死判定ボックスの上辺 y（GDD §4-5 の落下死判定） */
export function lethalTop(y: number): number {
  return y + PLAYER_HITBOX_OY
}

/** 接地プローブ（GDD §4-2）。左端と右端の x を返す */
export function footSpan(worldX: number): { left: number; right: number } {
  const left = worldX + PLAYER_FOOT_OX
  return { left, right: left + PLAYER_FOOT_W }
}

/** 接地プローブの y（スプライト最下辺） */
export function footY(y: number): number {
  return y + PLAYER_FOOT_OY
}

/** 新しいプレイヤー物理状態を作る（地面に立った状態） */
export function createPlayer(groundY: number): PlayerPhysics {
  const y = standingY(groundY)
  return {
    y,
    vy: 0,
    state: 'GROUNDED',
    prevLethalBottom: lethalBottom(y),
    lastGroundedFrame: 0,
    jumpedSinceGround: false,
    groundedSince: 0,
    supportIndex: -1,
  }
}

/**
 * ジャンプを発火する。高さは常に固定（GDD §2-4）。
 * v0 は通常 JUMP_V0、バネのみ SPRING_V0。
 */
export function startJump(p: PlayerPhysics, v0: number = JUMP_V0): void {
  p.vy = -v0
  p.state = 'RISING'
  p.jumpedSinceGround = true
  p.supportIndex = null
}

/**
 * 1フレームぶんの垂直積分（固定タイムステップ）。
 * 落下速度は TERMINAL_VY でクランプする（GDD §2-1）。
 */
export function integrateVertical(p: PlayerPhysics): void {
  const vyNext = Math.min(p.vy + GRAVITY, TERMINAL_VY)
  p.y += (p.vy + vyNext) * 0.5
  p.vy = vyNext
  p.state = p.vy < 0 ? 'RISING' : 'FALLING'
}

/** ジャンプ開始から k フレーム後の到達高さ（px）。検算・ソルバ用の解析解 */
export function jumpHeightAt(k: number, v0: number = JUMP_V0): number {
  return v0 * k - (GRAVITY / 2) * k * k
}

/** ステージ速度から1ジャンプの水平到達距離を出す（GDD §2-3 の表と一致） */
export function horizontalReach(speedPxPerFrame: number): number {
  // 表の値: S1 2.50 -> 104 / S2 2.75 -> 115 / S3 3.00 -> 125
  return Math.round(((2 * JUMP_V0) / GRAVITY) * speedPxPerFrame)
}

/**
 * OB-14 槍を越えられている時間と生存窓（GDD §15-5-2 の解析解）。
 *
 * 致死ボックス下端の高さは `C(f) = 1 + V0·f − (G/2)·f²`（台形則の解析解）。
 * 槍の判定上端は視覚頂点より 2px 下なので、越えられる条件は `C(f) > h − 2`。
 *
 *   越えている時間[f] = 2√(V0² − 2G(h − 3)) / G
 *   生存窓[f]        = 上記 − (プレイヤー判定幅 10 + 槍判定幅 4) / 速度
 *
 * **データを書いた時点で速度別の窓を出せるようにするためのもの。**
 * ソルバの全探索（1本書き終えないと鳴らない）を待たずに早期警告を出す用途で使う。
 * 越えられない高さでは負値を返す。
 */
export function spearSurvivalWindow(h: number, speedPxPerFrame: number): number {
  const inner = JUMP_V0 * JUMP_V0 - 2 * GRAVITY * (h - 3)
  if (inner <= 0) return -1
  const over = (2 * Math.sqrt(inner)) / GRAVITY
  return over - (PLAYER_HITBOX_W + SPEAR_HIT_W) / speedPxPerFrame
}
