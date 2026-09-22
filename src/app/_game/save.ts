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

/**
 * タップ精度の要約統計（GDD §16-7【P0】）。
 *
 * **これが無いと `E[D]` がまた自己参照に戻る。**
 * `E[D]` が外部に接続されているのは σ があるからで、その σ が推測のままなら、
 * 指標体系は再び「企画の想定から導かれた基準で企画の想定を検算する」形に戻る。
 * 今回の失敗は「測れなかった」のではなく、**測る量を定義していなかった**ことによる。
 *
 * 記録するのは **1ジャンプごとの `(実際のタップフレーム − 生存窓の中心)` [ms]** の分布だけ。
 * 座標列・時刻・入力列は保存しない（個人を推定しうる情報を残さない）。
 * 平均と分散は Welford 法で逐次更新するので、履歴を持たずに σ が出せる。
 */
export interface TapStats {
  /** 標本数 */
  n: number
  /** 誤差の平均 [ms]。早押し傾向なら負に寄る */
  mean: number
  /** Welford の M2（= Σ(x-mean)^2）。σ = sqrt(M2/(n-1)) */
  m2: number
  /** ヒストグラム 16 ビン。[-120, +120] ms を 15ms 刻みで、両端は外れ値を含む */
  hist: number[]
}

/** ヒストグラムのビン数と範囲（±120ms を 16 等分＝15ms 刻み） */
export const TAP_HIST_BINS = 16
export const TAP_HIST_RANGE_MS = 120

export function emptyTapStats(): TapStats {
  return { n: 0, mean: 0, m2: 0, hist: new Array(TAP_HIST_BINS).fill(0) }
}

/** 1ジャンプぶんの誤差を足し込む（Welford 法・履歴を持たない） */
export function recordTapError(stats: TapStats, errorMs: number): void {
  if (!Number.isFinite(errorMs)) return
  stats.n += 1
  const d = errorMs - stats.mean
  stats.mean += d / stats.n
  stats.m2 += d * (errorMs - stats.mean)
  const t = (errorMs + TAP_HIST_RANGE_MS) / ((2 * TAP_HIST_RANGE_MS) / TAP_HIST_BINS)
  const bin = Math.max(0, Math.min(TAP_HIST_BINS - 1, Math.floor(t)))
  stats.hist[bin] += 1
}

/** 実測 σ [ms]。標本が 2 未満なら null（推測値で上書きしない） */
export function tapSigmaMs(stats: TapStats): number | null {
  if (stats.n < 2) return null
  return Math.sqrt(stats.m2 / (stats.n - 1))
}

function parseTapStats(raw: unknown): TapStats {
  const o = (raw ?? {}) as Record<string, unknown>
  const hist = Array.isArray(o.hist)
    ? o.hist.map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0))
    : []
  const out = emptyTapStats()
  out.n = Math.max(0, Math.floor(num(o.n, 0)))
  out.mean = num(o.mean, 0)
  out.m2 = Math.max(0, num(o.m2, 0))
  for (let i = 0; i < TAP_HIST_BINS; i++) out.hist[i] = hist[i] ?? 0
  return out
}

export interface SaveData {
  /** スキーマバージョン。移行は `migrate()` が担う */
  v: SaveVersion
  stages: Record<string, StageRecord>
  total: { die: number; playMs: number }
  /** 最後にプレイしたステージ */
  last: number
  opt: { sfx: boolean; reducedFlash: boolean }
  /** タップ精度の要約統計（GDD §16-7）。σ の実測に使う */
  stats: TapStats
}

/** 現行スキーマバージョン（GDD §15-9-3 で v1 → v2 へ移行） */
export const SAVE_VERSION = 2
export type SaveVersion = 2

/**
 * 総ステージ数（GDD §15-6 の6章×5本）。
 * v2 移行時に 4..30 を初期状態で追加する。
 */
export const TOTAL_STAGES = 30

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
    v: SAVE_VERSION,
    stages: { '1': emptyStageRecord(true) },
    total: { die: 0, playMs: 0 },
    last: 1,
    opt: { sfx: true, reducedFlash: false },
    stats: emptyTapStats(),
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
 * v1 → v2 の移行（GDD §15-9-3【P0】）。
 *
 * **本作は既に公開済みで、遊んでいる人の localStorage に v1 のセーブが存在する。**
 * キー `jumpordie.save.v1` は変えない（変えると旧データが孤児になる）。
 * 中身の `v` だけを 2 に上げ、S1〜S3 の記録を必ず引き継ぐ。
 *
 * - `stages` に入っている記録は**そのまま全部引き継ぐ**（1..3 に限らない）
 * - `stages` 4..30 を初期状態で追加する
 * - `total` / `last` / `opt` はそのまま引き継ぐ
 * - **v2 に対しては何もしない**（二重移行の防止）
 */
function migrate(stages: Record<string, StageRecord>): Record<string, StageRecord> {
  for (let id = 1; id <= TOTAL_STAGES; id++) {
    const key = String(id)
    if (!stages[key]) stages[key] = emptyStageRecord(id === 1)
  }
  return stages
}

/**
 * 読み込み。**どんな入力でも例外を投げない。**
 *
 * 壊れた JSON・想定外の構造・未知のスキーマバージョン・storage 不在は
 * すべて初期状態にフォールバックする。ただし **v1 は捨てずに移行する**。
 * セーブが読めないことでゲームが起動しないのは論外（GDD §10-2）。
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
    const version = num(raw.v, 0)
    // 1（旧）と 2（現行）だけを受け付ける。未知のバージョンは初期状態で起動する
    if (version !== 1 && version !== SAVE_VERSION) return fresh

    const stages: Record<string, StageRecord> = {}
    const rawStages = (raw.stages ?? {}) as Record<string, unknown>
    if (rawStages && typeof rawStages === 'object') {
      for (const key of Object.keys(rawStages)) {
        const id = Number(key)
        if (!Number.isInteger(id) || id < 1 || id > TOTAL_STAGES) continue
        stages[key] = parseStage(rawStages[key])
      }
    }
    // v1 でも v2 でも、欠けているステージは初期状態で埋める（移行は冪等）
    migrate(stages)
    stages['1'].unlock = true

    const rawTotal = (raw.total ?? {}) as Record<string, unknown>
    const rawOpt = (raw.opt ?? {}) as Record<string, unknown>
    return {
      v: SAVE_VERSION,
      stages,
      total: {
        die: Math.max(0, Math.floor(num(rawTotal.die, 0))),
        playMs: Math.max(0, Math.floor(num(rawTotal.playMs, 0))),
      },
      last: Math.max(1, Math.min(TOTAL_STAGES, Math.floor(num(raw.last, 1)))),
      opt: {
        sfx: bool(rawOpt.sfx, true),
        reducedFlash: bool(rawOpt.reducedFlash, false),
      },
      // stats は v2 への**追加フィールド**。無ければ空で始める（バージョンは上げない）
      stats: parseTapStats(raw.stats),
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
