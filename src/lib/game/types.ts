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
/**
 * OB-08 飛行体。12x12。スクロールより速く左へ移動。
 *
 * G6（GDD §16-6）: `amp` / `period` / `phase` で**上下動**を足せる。
 * `amp = 0` なら従来どおりの水平直線（後方互換）。波形は三角波
 * （`swing` と同じ理由 — 等速で位置が読みやすく、暗記対象が位相ひとつに収まる）。
 *
 * **上下動は片側**: `y = alt - amp * tri()`、`tri ∈ [0,1]`（彩色 映 R18 の訂正）。
 * GDD §16-6 本文の「`alt ± amp`」は誤りで、両側にすると `alt = LOW` の個体が地面を貫通する。
 * したがって **`alt` は基準高度ではなく、その個体が取りうる最下点**である。
 * 描き分けは `alt` 基準のまま（`alt = LOW` なら `amp` に依らず地に接する＝ネズミ）。
 */
export type FlyObj = {
  t: 'fly'
  x: number
  alt: FlyAltitude
  vx: number
  /** 上下動の振幅。0 で従来どおり。8〜24px */
  amp?: number
  /** 上下動の周期 30〜90f */
  period?: number
  /** 位相オフセット f */
  phase?: number
}
/** OB-09 崩落床。24x8。着地から delay フレーム後に落下・消滅 */
export type CrumbleObj = { t: 'crumble'; x: number; y: number; delay: number }
/** OB-10 バネ。12x8。上面接触で強制ジャンプ（非致死） */
export type SpringObj = { t: 'spring'; x: number }
/**
 * OB-11 横振りブロック（G1「障害物が動く」・GDD §15-2）。
 * 16x16。判定は `block` と同一（上面に着地可・側面は死）。
 * 運動は **三角波・等速**: `X(f) = x + amp * tri((f + phase) / period)`。
 * 正弦波にすると端で速度が落ち「どこで止まって見えるか」を別途覚える必要が生じる。
 * 覚えるべきものを増やさないため等速を採る。
 */
export type SwingObj = {
  t: 'swing'
  x: number
  y: number
  /** 振幅 8〜48 px */
  amp: number
  /** 周期 60〜180 f */
  period: number
  /** 位相オフセット f */
  phase: number
}

/**
 * OB-14 槍（G4「飛び越えようとしたら飛び出してくる」・GDD §15-5）。
 *
 * ジャンプの頂点よりやや低い高さを最大とし、**ジャストタイミングなら越えられる**。
 * 視覚幅 6px に対し判定幅 4px、視覚頂点より 2px 下を判定上端とする（§4-3 のトゲと同思想）。
 *
 * **トリガーは `cameraX`（= stageFrame x 速度）のみを参照する。**
 * プレイヤーの位置・速度・入力・状態を一切参照してはならない（憲法2 / §15-5-4【P0】）。
 */
export type SpearObj = {
  t: 'spear'
  /** 基部のワールドX */
  x: number
  /** 最大高（視覚）。40 <= h <= 54 */
  h: number
  /** カメラXがこの値を超えたフレームから伸長開始 */
  triggerX: number
  /** 伸長フレーム数。6 <= rise <= 20（既定 8 = 133ms） */
  rise: number
}

/**
 * OB-15 落ちる浮遊物（G5「浮遊オブジェクトの落下」・GDD §16-6）。
 *
 * 16x16。宙に浮いていて、**`falls: true` の個体だけが落ちる**。
 * 落ちる個体は `y ± 1px`・周期 24f の三角波で**微かに揺れる**のが唯一の予兆。
 * 「情報は与えるが、注意の予算を超えた場所に置く」— 一目で分かれば裏切りが消え、
 * 情報が無ければ理不尽になる。動きなら、注意を向けていないと見落とす。
 *
 * 落ちる → 下が塞がる → **上を通る**。落ちない → その高さが塞がる → **下を通る**。
 * 操作は「跳ぶ／跳ばない」のままで、選択はタップのタイミングに還元される（憲法1 ✓）。
 *
 * **トリガーは `cameraX`（= stageFrame x 速度）のみ。**
 * プレイヤーの位置・速度・入力・状態を一切参照してはならない（憲法2 / §15-5-4 と同じ規律）。
 * 落下の重力はプレイヤーと同一の `GRAVITY = 0.24`（読みやすさのため別の値にしない）。
 *
 * `crumble`（踏んでから落ちる＝プレイヤー起因）とは別物なので、
 * **同一 worldX 区間 ±320px に両者を置いてはならない**（§16-6）。
 */
export type DropObj = {
  t: 'drop'
  x: number
  /** 静止時の上辺 y */
  y: number
  /** カメラXがこの値を超えたフレームから落下開始 */
  triggerX: number
  /** 落ちるか。落ちる個体だけが地上を塞ぐ */
  falls: boolean
  /**
   * 予兆（揺れ）を出すか。**既定は true**（省略時は安全側＝予兆あり）。
   *
   * `false` にすると**落ちるのに揺れない**＝初見殺しになる。社長指示:
   * 「後半は予兆無しで落下でも面白い」。**オブジェクト単位**で持つので、
   * 「このステージの3個のうち1個だけ予兆が無い」という形が作れる。
   *
   * **`falls = false` かつ `tell = true`（落ちないのに揺れる）は禁止**。
   * 揺れて落ちない個体を1つ置けば予兆が信用されなくなり、
   * **前半の学習がその1個で無効になる**（企画 駆）。検査で弾く。
   *
   * 憲法2 とは衝突しない。**落ちた瞬間に、どれが落ちるかが画面上の事実として分かる**ので、
   * 死因は「覚えていなかった」であり、配置は決定論的だから覚えれば必ず通れる。
   * `spear` の伏せ状態を隠してはならなかったのとは性質が違う（あれは見えないままだった）。
   *
   * **`E[D]` には混ぜない。** 予兆無しの死は初見で必ず起き2回目以降は起きない＝
   * タップ精度（σ）に由来しないので、σ ベースの指標では捉えられない。混ぜると
   * 何を測っているか分からなくなる。企画 駆の別枠の裁定を待つ。
   */
  tell?: boolean
}

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
  | SwingObj
  | SpearObj
  | DropObj
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
  /**
   * 推奨ルート上の各タップの生存窓 `[最初のフレーム, 最後のフレーム]`（ソルバが生成）。
   *
   * **σ の実測（GDD §16-7【P0】）にしか使わない。** 実行時のゲーム進行には一切関与しない。
   * これが無いと「タップフレーム − 窓の中心」が実行時に計算できず、
   * σ が推測のままになって `E[D]` が自己参照に戻る。
   * `scripts/verify-stages.ts --emit-windows` が書き戻す。
   */
  tapWindows?: readonly (readonly [number, number])[]
}

/**
 * ソルバの検査基準（GDD §6-3 の表から引く）。
 * 2026-09-21 改訂（§14-②）: 「最小タップ窓」は下限のみの規定から
 * **下限と上限を持つ帯**に変わった。窓は §14-① の「生存窓」で測る。
 */
export type StageBudget = {
  /**
   * 障害物 総数（GDD §6-3）。
   * 【2026-09-22 §15-16】**検査には使わない。** 総数は「長さ(秒) x 1.286 個/秒」の
   * 上限式に変わり、設計値としての単一値は撤回された（P1 で実測の記録に置き換える）。
   */
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
  /** 狭窓密度の帯（GDD §15-7-3 / §15-7-4）。生存窓 10f 以下の本数 / ステージ長(秒) */
  tightDensity: readonly [number, number]
  /** 抑制率の帯。跳んではいけない障害物の数 / 全挑戦オブジェクト数 */
  suppressRatio: readonly [number, number]
  /** 複合度の帯（警告のみ）。複合パターン区間の長さ合計 / ステージ長 */
  compositeRatio: readonly [number, number]
  /**
   * 平均要求タップ/秒（GDD §6-3 の列）。推奨ルートのタップ数 / ステージ長(秒)。
   * 【2026-09-22 §15-16】**検査には使わない。** 単一設計値は撤回され、
   * 章ごとの帯（CHAPTER_TAPS_PER_SEC_BAND）に変わった。S8 0.90 / S9 1.00 / S10 1.10 は
   * 実効上限（章II で 0.89）を超えており、**いかなる配置でも到達できない値だった**。
   * P1 で実測の記録に置き換える。
   */
  tapsPerSecond: number
  /**
   * 目標死亡回数（GDD §16-2 / §16-7）。`E[D] = 1/Π(1-p_i) - 1` をこの値の帯で判定する。
   * **唯一、σ という人間側の実測量に接続された指標**。ほかの指標は全て
   * 企画の想定から導かれていて、自己参照になっていた。
   */
  deathTarget: number
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
