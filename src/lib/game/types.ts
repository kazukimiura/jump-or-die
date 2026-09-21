/**
 * JumpOrDie — エンジン層 型定義
 *
 * 出典: GDD §7-1（ステージデータ構造）/ §5-1（障害物カタログ全10種）
 * 本ファイルは React / zustand / DOM に一切依存しない（GDD §12-2）。
 *
 * 【重要】S1〜S3 で使わない障害物（ceil / plat / lift / fly / crumble / spring）も
 * 型としては全種定義する。ステージ 4〜10 を後から `src/data/stages.ts` に
 * 差し込むだけで拡張できる構造にするため（社長承認 2026-09-21 スコープ確定の補足）。
 */

// ---------------------------------------------------------------------------
// 障害物定義（GDD §7-1 の ObjDef をそのまま実装）
// ---------------------------------------------------------------------------

/** 飛行体 OB-08 の高度3段階（GDD §5-2） */
export type FlyAltitude = 'LOW' | 'MID' | 'HIGH'

/** OB-01 ブロック小 / OB-02 ブロック大。上面に着地可、側面・下面は致死 */
export type BlockObj = { t: 'block'; x: number; w: number; h: number }
/** OB-03 谷。地面タイルの欠落。落下すると FALL 死 */
export type PitObj = { t: 'pit'; x: number; w: number }
/** OB-06 トゲ床。幅 = n * 8、高さ 8。全面致死・上面に乗れない */
export type SpikeObj = { t: 'spike'; x: number; n: number }
/** OB-04 天井。高さ 16 固定。接触＝死 */
export type CeilObj = { t: 'ceil'; x: number; w: number; y: number }
/** OB-05 浮遊足場。32x8 固定。上面のみ着地可、側面・下面はすり抜け（非致死） */
export type PlatObj = { t: 'plat'; x: number; y: number }
/** OB-07 昇降ブロック。16x16。三角波で上下動。乱数なし（GDD §5-4） */
export type LiftObj = {
  t: 'lift'
  x: number
  y: number
  amp: number
  period: number
  phase: number
}
/** OB-08 飛行体。12x12。スクロールより速く左へ移動 */
export type FlyObj = { t: 'fly'; x: number; alt: FlyAltitude; vx: number }
/** OB-09 崩落床。24x8。着地から delay フレーム後に落下・消滅 */
export type CrumbleObj = { t: 'crumble'; x: number; y: number; delay: number }
/** OB-10 バネ。12x8。上面接触で強制ジャンプ（非致死） */
export type SpringObj = { t: 'spring'; x: number }
/** 予告マーカー（GDD §7-3 ルールB）。当たり判定を持たない描画専用 */
export type WarnObj = { t: 'warn'; x: number }

export type ObjDef =
  | BlockObj
  | PitObj
  | SpikeObj
  | CeilObj
  | PlatObj
  | LiftObj
  | FlyObj
  | CrumbleObj
  | SpringObj
  | WarnObj

export type ObjKind = ObjDef['t']

// ---------------------------------------------------------------------------
// ステージ定義（GDD §7-1）
// ---------------------------------------------------------------------------

export type StageDef = {
  /** 1..10 */
  id: number
  /** 'FIRST STEP' など。GDD §6-2 の表記に従う */
  name: string
  /** スクロール速度。ステージ中は不変（GDD §6-2） */
  speedPxPerFrame: number
  /** ゴールのワールドX = speedPxPerFrame * 60 * 長さ(秒) */
  lengthPx: number
  /** 開始直後の安全走路 = ceil(speed*60*0.8)、最低120（GDD §6-2） */
  safeRunwayPx: number
  /** 地面上面。現状全ステージ 148（GDD §11-1） */
  groundY: number
  /** worldX の昇順に並べる（必須。描画カリングの前提 / ソルバ検査5） */
  objects: ObjDef[]
}

/**
 * ソルバの検査基準（GDD §6-3 の表から引く）。
 * 2026-09-21 改訂（§14-②）: 「最小タップ窓」は下限のみの規定から
 * **下限と上限を持つ帯**に変わった。窓は §14-① の「生存窓」で測る。
 */
export type StageBudget = {
  /** 障害物 総数（GDD §6-3） */
  objectCount: number
  /** 最大チェイン長。不合格条件（GDD §6-3 / §14-③） */
  maxChain: number
  /** 生存窓 下限（フレーム）。下回ると不合格（GDD §6-3） */
  windowMinFrames: number
  /** 生存窓 上限（フレーム）。超えると緩すぎで不合格。S1 は除外（GDD §6-3） */
  windowMaxFrames: number
  /** クライマックス位置（到達率 0..1）。§7-3 ルールE */
  climaxAt: number
  /** クライマックス検査を警告扱いにするか（S1 のみ true。GDD §14-④） */
  climaxWarnOnly: boolean
}

// ---------------------------------------------------------------------------
// 実行時（GDD §4 / §5-4）
// ---------------------------------------------------------------------------

export type Rect = { x: number; y: number; w: number; h: number }

export type PlayerState = 'GROUNDED' | 'RISING' | 'FALLING' | 'DEAD'

/** 死因。GDD §4-6 の死因可視化に使う */
export type DeathCause = 'CRUSH' | 'SPIKE' | 'CEILING' | 'FLYER' | 'FALL'

/**
 * stageFrame から解決された障害物の実体。
 * 動体（lift / fly）も含め、同じ stageFrame なら必ず同じ値になる（GDD §12-6）。
 */
export type ResolvedObj = {
  /** stage.objects 内の添字。死因の可視化・崩落床の状態管理に使う */
  index: number
  def: ObjDef
  kind: ObjKind
  /** ワールド座標（整数px）。描画と判定で必ず同じ値を使う */
  x: number
  y: number
  w: number
  h: number
  /** 上面に着地できるか */
  landable: boolean
  /** 接触＝死か */
  lethal: boolean
  /** 上面接触で強制ジャンプするか（OB-10 バネ） */
  springy: boolean
  /** 崩落済みで既に消滅しているか（OB-09） */
  gone: boolean
}

/** 着地面の候補 */
export type Surface = {
  /** 上面 y */
  top: number
  /** 左端 x（ワールド） */
  x: number
  /** 幅 */
  w: number
  /** -1 は地面。それ以外は stage.objects の添字 */
  index: number
  springy: boolean
}

/** プレイヤーの物理状態。float のまま保持する（GDD §12-3） */
export type PlayerPhysics = {
  /** スプライト左上の y。float */
  y: number
  /** 垂直速度 px/frame。下向きが正 */
  vy: number
  state: PlayerState
  /** 前フレームの致死ボックス下辺（GDD §4-4 の判定順序1） */
  prevLethalBottom: number
  /** 最後に接地していた stageFrame。コヨーテタイム判定に使う */
  lastGroundedFrame: number
  /** 接地を離れてからジャンプを消費したか（コヨーテの二重取り防止） */
  jumpedSinceGround: boolean
  /** 接地し始めた stageFrame。チェイン長の計測に使う */
  groundedSince: number
  /** 現在乗っている面（-1 は地面 / null は空中） */
  supportIndex: number | null
}

/**
 * シミュレーション状態。
 * stageFrame と本オブジェクトだけでステージ全体が一意に決まる（GDD §12-6）。
 */
export type SimState = {
  /** ステージ開始からの経過フレーム。リトライで 0 */
  stageFrame: number
  player: PlayerPhysics
  /** 先行入力バッファ用。最後にタップされた stageFrame */
  lastTapFrame: number
  /** 崩落床（OB-09）の起動フレーム。未起動は -1。stage.objects の添字で引く */
  crumbleTrigger: Int32Array
  dead: boolean
  deathCause: DeathCause | null
  /** 殺した障害物の添字（GDD §4-6）。落下死は -1 */
  deathObjIndex: number
  cleared: boolean
}
