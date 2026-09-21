/**
 * save.ts — 記録の保存（localStorage）
 *
 * 出典: GDD §10-1（記録する項目）/ §10-2（スキーマ）/ 付録A（STORAGE_KEY）
 *
 * 絶対制約:
 *   - キーは `jumpordie.save.v1`
 *   - **書き込みはステージ終了時（死亡確定 or クリア確定）と設定変更時のみ。**
 *     プレイ中のフレームごとの書き込みは `localStorage` が同期APIであるためフレーム落ち
 *     ＝入力遅延を招く。憲法4 違反（GDD §10-2）
 *   - `v` が未知／パース失敗／localStorage 自体が使えない場合は、**例外を投げずに
 *     初期状態で起動する**。セーブが読めないことでゲームが起動しないのは論外
 *
 * React / DOM に依存しない。`storage` は外から差してテスト可能にしてある。
 */

import { STORAGE_KEY } from '@/lib/game/constants'

/** localStorage 互換の最小インターフェース */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** ステージ1本ぶんの記録（GDD §10-2） */
export interface StageRecord {
  /** 自己ベスト到達率 0.0–100.0 */
  best: number
  /** クリア済み */
  clear: boolean
  /** ベストクリアタイム(ms)。未クリアは null */
  time: number | null
  /** 試行回数（死亡＋クリア） */
  try: number
  /** 死亡回数 */
  die: number
  /** 解放済み */
  unlock: boolean
  /** 直近5回の死亡到達率（新しい順） */
  marks: number[]
}

export interface SaveData {
  /** スキーマバージョン。将来の移行用 */
  v: 1
  stages: Record<string, StageRecord>
  total: { die: number; playMs: number }
  /** 最後にプレイしたステージ */
  last: number
  opt: { sfx: boolean; reducedFlash: boolean }
}

/** 直近の死亡マーカーの保持数（GDD §10-2 marks） */
export const MARKS_KEEP = 5
/** 50回死亡で次ステージを解放する（GDD §6-5【P1】） */
export const MERCY_DEATHS = 50

export function emptyStageRecord(unlock = false): StageRecord {
  return { best: 0, clear: false, time: null, try: 0, die: 0, unlock, marks: [] }
}

/** 初期状態。ステージ1だけ解放されている */
export function defaultSave(): SaveData {
  return {
    v: 1,
    stages: { '1': emptyStageRecord(true) },
    total: { die: 0, playMs: 0 },
    last: 1,
    opt: { sfx: true, reducedFlash: false },
  }
}

/** 記録を取り出す。無ければ作る（ステージ1のみ既定で解放） */
export function stageRecord(save: SaveData, id: number): StageRecord {
  const key = String(id)
  let rec = save.stages[key]
  if (!rec) {
    rec = emptyStageRecord(id === 1)
    save.stages[key] = rec
  }
  return rec
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback

function parseStage(raw: unknown): StageRecord {
  const o = (raw ?? {}) as Record<string, unknown>
  const marks = Array.isArray(o.marks)
    ? o.marks.filter((m): m is number => typeof m === 'number' && Number.isFinite(m))
    : []
  return {
    best: Math.max(0, Math.min(100, num(o.best, 0))),
    clear: bool(o.clear, false),
    time: typeof o.time === 'number' && Number.isFinite(o.time) ? o.time : null,
    try: Math.max(0, Math.floor(num(o.try, 0))),
    die: Math.max(0, Math.floor(num(o.die, 0))),
    unlock: bool(o.unlock, false),
    marks: marks.slice(0, MARKS_KEEP),
  }
}

/**
 * 読み込み。**どんな入力でも例外を投げない。**
 * 未知のスキーマバージョン・壊れた JSON・storage 不在はすべて初期状態にフォールバックする。
 */
export function loadSave(storage: StorageLike | null): SaveData {
  const fresh = defaultSave()
  if (!storage) return fresh
  let text: string | null = null
  try {
    text = storage.getItem(STORAGE_KEY)
  } catch {
    return fresh
  }
  if (!text) return fresh

  try {
    const raw = JSON.parse(text) as Record<string, unknown>
    if (num(raw.v, 0) !== 1) return fresh

    const stages: Record<string, StageRecord> = {}
    const rawStages = (raw.stages ?? {}) as Record<string, unknown>
    for (const key of Object.keys(rawStages)) {
      const id = Number(key)
      if (!Number.isInteger(id) || id < 1 || id > 10) continue
      stages[key] = parseStage(rawStages[key])
    }
    if (!stages['1']) stages['1'] = emptyStageRecord(true)
    stages['1'].unlock = true

    const rawTotal = (raw.total ?? {}) as Record<string, unknown>
    const rawOpt = (raw.opt ?? {}) as Record<string, unknown>
    return {
      v: 1,
      stages,
      total: {
        die: Math.max(0, Math.floor(num(rawTotal.die, 0))),
        playMs: Math.max(0, Math.floor(num(rawTotal.playMs, 0))),
      },
      last: Math.max(1, Math.min(10, Math.floor(num(raw.last, 1)))),
      opt: {
        sfx: bool(rawOpt.sfx, true),
        reducedFlash: bool(rawOpt.reducedFlash, false),
      },
    }
  } catch {
    return fresh
  }
}

/**
 * 書き込み。**例外を投げない**（プライベートブラウズ等で失敗しても続行する）。
 * 呼び出しはステージ終了時と設定変更時のみに限ること。
 */
export function writeSave(storage: StorageLike | null, save: SaveData): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(save))
  } catch {
    /* 保存できなくてもゲームは続く */
  }
}
