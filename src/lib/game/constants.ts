/**
 * JumpOrDie — 定数
 *
 * 出典: GDD 付録A「主要定数のクイックリファレンス」。
 * **値は一字一句そのまま**。独自に丸めない（社長承認済みの絶対制約5）。
 */

// == 物理（全ステージ共通） =================================================

/** 固定タイムステップ。可変dtで物理を回さない（GDD §12-1） */
export const FIXED_DT = 1 / 60
/** 固定タイムステップ（ms）。16.6667 */
export const FIXED_DT_MS = 1000 / 60

/** 重力加速度 0.24 px/frame² (864 px/s²) */
export const GRAVITY = 0.24
/** ジャンプ初速 5.00 px/frame (300 px/s)。固定値・可変なし（GDD §2-4） */
export const JUMP_V0 = 5.0
/** バネ初速 7.00 px/frame (420 px/s)。OB-10 専用 */
export const SPRING_V0 = 7.0
/** 最大落下速度 8.00 px/frame (480 px/s) */
export const TERMINAL_VY = 8.0

/** 最大到達高さ 52.08 px */
export const JUMP_APEX = 52.08
/** 頂点到達フレーム 20.83 f (347 ms) */
export const JUMP_APEX_FRAMES = 20.83
/** 滞空時間 41.67 f (694 ms) */
export const JUMP_AIRTIME = 41.67
/** 滞空時間（秒） 0.694 s。水平到達距離の算出に使う（GDD §2-3） */
export const JUMP_AIRTIME_SEC = JUMP_AIRTIME / 60

// == 入力 ===================================================================

/** 先行入力バッファ 6 f (100 ms)。早すぎたタップだけを救う（GDD §3-2） */
export const INPUT_BUFFER = 6
/** コヨーテタイム 3 f (50 ms)。踏み外しだけを救う（GDD §3-3） */
export const COYOTE_TIME = 3
/** 二段ジャンプ: なし（GDD §3-4） */
export const DOUBLE_JUMP = false
/** ホールド変調: なし（GDD §2-4） */
export const HOLD_MODULATION = false

// == 判定 ===================================================================

/** プレイヤースプライト 16 x 16 */
export const PLAYER_SPRITE_W = 16
export const PLAYER_SPRITE_H = 16

/** 致死判定ボックス offset(3, 2) size(10, 13)（GDD §4-2） */
export const PLAYER_HITBOX_OX = 3
export const PLAYER_HITBOX_OY = 2
export const PLAYER_HITBOX_W = 10
export const PLAYER_HITBOX_H = 13

/** 接地プローブ offset(3, 16) width 10（GDD §4-2） */
export const PLAYER_FOOT_OX = 3
export const PLAYER_FOOT_OY = 16
export const PLAYER_FOOT_W = 10

/** 障害物判定の内側マージン 1 px */
export const OBSTACLE_INSET = 1
/** トゲ・飛行体は 2 px */
export const OBSTACLE_INSET_SHARP = 2

/** 落下死の閾値。致死ボックス上辺 > groundY + 40 で死亡（GDD §4-5） */
export const FALL_DEATH_OFFSET = 40

/** ブロック上面着地の許容量。prevBottom <= 上辺 + 1（GDD §4-4） */
export const LANDING_TOLERANCE = 1
/** 接地維持の許容量。乗っている面の上下動に追従する範囲 */
export const SUPPORT_TOLERANCE = 3

// == 画面 ===================================================================

/** 論理解像度 320 x 180（固定・端末非依存。GDD §11-1【P0】） */
export const LOGICAL_W = 320
export const LOGICAL_H = 180
/** HUD 帯 y 0 .. 11 */
export const HUD_BAND_H = 12
/** 地面上面 */
export const GROUND_Y = 148
/** プレイヤー固定X */
export const PLAYER_X = 56
/** 先読み可視距離 252 px（320 - 68） */
export const LOOKAHEAD_PX = 252

// == 演出 ===================================================================

/** ヒットストップ 100 ms (6 f) */
export const DEATH_HITSTOP = 6
/** 飛散 180 ms (11 f) */
export const DEATH_BURST = 11
/** リセット 20 ms (1 f) */
export const DEATH_RESET = 1
/** 死亡→再開 合計 300 ms */
export const DEATH_TOTAL_MS = 300
/** NEW BEST 表示 600 ms */
export const NEW_BEST_DISPLAY_MS = 600

// == 保存 ===================================================================

export const STORAGE_KEY = 'jumpordie.save.v1'

// == 障害物の固定寸法（GDD §5-1 カタログ） =================================

/** OB-06 トゲ床: 1個あたり 8 x 8 */
export const SPIKE_UNIT = 8
export const SPIKE_H = 8
/** OB-04 天井: 高さ 16 固定 */
export const CEIL_H = 16
/** OB-05 浮遊足場: 32 x 8 固定 */
export const PLAT_W = 32
export const PLAT_H = 8
/** OB-07 昇降ブロック: 16 x 16 */
export const LIFT_W = 16
export const LIFT_H = 16
/** OB-08 飛行体: 12 x 12 */
export const FLY_W = 12
export const FLY_H = 12
/** OB-08 飛行体の高度別 y（GDD §5-2） */
export const FLY_ALT_Y = { LOW: 136, MID: 112, HIGH: 88 } as const
/** OB-09 崩落床: 24 x 8、delay=10 */
export const CRUMBLE_W = 24
export const CRUMBLE_H = 8
export const CRUMBLE_DELAY = 10
/** OB-09 崩落後に消滅するまでのフレーム数 */
export const CRUMBLE_FALL_FRAMES = 12
/** OB-10 バネ: 12 x 8 */
export const SPRING_W = 12
export const SPRING_H = 8

// == 配置上限（GDD §5-3） ==================================================

/** 谷の最小幅 24 px 固定 */
export const PIT_MIN_W = 24
/** 谷の最大幅 = 水平到達距離 x 0.90 */
export const PIT_MAX_RATIO = 0.9
/** 足場・ブロック間の最大距離 = 水平到達距離 x 0.92 */
export const GAP_MAX_RATIO = 0.92
/** 障害物の最大高さ 40 px */
export const OBSTACLE_MAX_H = 40
/** 連続チェインの上限 5 回（GDD §7-3 ルールD） */
export const CHAIN_MAX = 5
/** チェイン判定の閾値。着地からこのフレーム数以内の再ジャンプを連鎖とみなす */
export const CHAIN_GROUNDED_FRAMES = INPUT_BUFFER

// == クライマックス位置（GDD §7-3 ルールE） ================================

export const CLIMAX_MIN_RATIO = 0.85
export const CLIMAX_MAX_RATIO = 0.95
