/**
 * JumpOrDie — 当たり判定
 *
 * 出典: GDD §4（当たり判定の設計）
 *
 * 基本方針（§4-1）: **非対称な寛容さ**
 *   プレイヤーの判定は見た目より小さく、障害物の判定は見た目どおり（+1px だけ甘く）。
 *
 * 判定は2系統に分離する（§4-2）。ここを一つにまとめるとどちらかが必ず破綻する。
 *   - 致死判定ボックス: offset(3,2) size(10,13)
 *   - 接地プローブ:     offset(3,16) width 10
 */

import {
  FALL_DEATH_OFFSET,
  LANDING_TOLERANCE,
  OBSTACLE_INSET,
  OBSTACLE_INSET_SHARP,
  SUPPORT_TOLERANCE,
} from './constants'
import { lethalTop } from './physics'
import type { DeathCause, ObjKind, Rect, ResolvedObj, Surface } from './types'

/** 矩形の交差（辺の接触は交差とみなさない） */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  )
}

/** 水平方向だけの重なり */
export function spansOverlap(
  aLeft: number,
  aRight: number,
  bLeft: number,
  bRight: number,
): boolean {
  return aLeft < bRight && aRight > bLeft
}

/** 種別ごとの判定の内側マージン（GDD §4-3） */
export function insetOf(kind: ObjKind): number {
  // トゲ・飛行体は 2px。三角形/動体は見た目より甘くする
  return kind === 'spike' || kind === 'fly'
    ? OBSTACLE_INSET_SHARP
    : OBSTACLE_INSET
}

/**
 * 障害物の致死判定矩形。致死でないもの（谷・足場・崩落床・バネ・予告）は null。
 * 足場/崩落床/バネの側面・下面は **非致死**（すり抜け）。GDD §4-3。
 */
export function killRect(o: ResolvedObj): Rect | null {
  if (!o.lethal || o.gone) return null
  const i = insetOf(o.kind)
  const w = o.w - i * 2
  const h = o.h - i * 2
  if (w <= 0 || h <= 0) return null
  return { x: o.x + i, y: o.y + i, w, h }
}

/** 死因（GDD §4-6 の可視化に使う） */
export function causeOf(kind: ObjKind): DeathCause {
  switch (kind) {
    case 'spike':
      return 'SPIKE'
    case 'ceil':
      return 'CEILING'
    case 'fly':
      return 'FLYER'
    default:
      return 'CRUSH'
  }
}

/**
 * 着地面。上面は §4-4 の着地判定が優先されるため、
 * **見た目どおりの矩形**（インセットなし）で取る。1px 内側にすると足が浮く。
 */
export function surfaceOf(o: ResolvedObj): Surface | null {
  if (!o.landable || o.gone) return null
  return { top: o.y, x: o.x, w: o.w, index: o.index, springy: o.springy }
}

/** 地面が [xL, xR) のどこかで健在か。谷（OB-03）に完全に収まると false */
export function isGroundSolid(
  pits: { x: number; w: number }[],
  xL: number,
  xR: number,
): boolean {
  for (let i = 0; i < pits.length; i++) {
    const p = pits[i]
    if (p.x + p.w <= xL) continue
    if (p.x >= xR) break
    // 足の一部でも地面に残っていれば支持される（縁での踏み外しを甘くする）
    if (p.x <= xL && p.x + p.w >= xR) return false
  }
  return true
}

/**
 * 落下中の着地面を探す（GDD §4-4 の判定順序）。
 *
 *   1. 前フレームの致死ボックス下辺 prevBottom を使う（現フレームだけで見ない）
 *   2. vy > 0 かつ prevBottom <= 上辺 + 1 かつ 水平に重なる → 着地
 *
 * 複数の面が候補になる場合、降下中に最初にぶつかるのは **最も高い面**なので
 * top が最小のものを選ぶ。
 */
export function findLanding(
  surfaces: Surface[],
  footLeft: number,
  footRight: number,
  prevBottom: number,
  newFootY: number,
): Surface | null {
  let best: Surface | null = null
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i]
    if (!spansOverlap(footLeft, footRight, s.x, s.x + s.w)) continue
    if (prevBottom > s.top + LANDING_TOLERANCE) continue
    if (newFootY < s.top) continue
    if (best === null || s.top < best.top) best = s
  }
  return best
}

/**
 * 接地を維持できる面を探す。
 * 乗っている面が上下に動く（OB-07 昇降ブロック）場合に追従するため、
 * 足元 ±SUPPORT_TOLERANCE の範囲を見る。
 */
export function findSupport(
  surfaces: Surface[],
  footLeft: number,
  footRight: number,
  currentFootY: number,
): Surface | null {
  let best: Surface | null = null
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i]
    if (!spansOverlap(footLeft, footRight, s.x, s.x + s.w)) continue
    if (s.top < currentFootY - SUPPORT_TOLERANCE) continue
    if (s.top > currentFootY + SUPPORT_TOLERANCE) continue
    if (best === null || s.top < best.top) best = s
  }
  return best
}

/**
 * 致死判定。接触した障害物の添字を返す（無接触は -1）。
 * `skipIndex` には同フレームで着地した面を渡す（上面着地が死に化けるのを防ぐ）。
 */
export function findLethalHit(
  objs: ResolvedObj[],
  player: Rect,
  skipIndex: number,
): number {
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]
    if (o.index === skipIndex) continue
    const k = killRect(o)
    if (k === null) continue
    if (rectsOverlap(player, k)) return i
  }
  return -1
}

/**
 * 落下死（GDD §4-5）。縁を割った瞬間には殺さない。
 * 致死ボックス上辺が groundY + 40 を超えたフレームで死亡。
 */
export function isFallDeath(y: number, groundY: number): boolean {
  return lethalTop(y) > groundY + FALL_DEATH_OFFSET
}
