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

/** OB-11 横振りブロック: 16 x 16（GDD §15-2） */
export const SWING_W = 16
export const SWING_H = 16
/** 振幅の範囲 8〜48 px */
export const SWING_AMP_MIN = 8
export const SWING_AMP_MAX = 48
/** 周期の範囲 60〜180 f */
export const SWING_PERIOD_MIN = 60
export const SWING_PERIOD_MAX = 180

/** OB-14 槍: 視覚幅 6px / 判定幅 4px（GDD §15-5） */
export const SPEAR_VIS_W = 6
export const SPEAR_HIT_W = 4
/** 視覚頂点より 2px 下を判定上端にする（§4-3 のトゲと同思想の甘さ） */
export const SPEAR_TIP_INSET = 2
/**
 * 最大高の範囲。54 は h=55.08 で頂点が接することから 2px の安全余裕を引いた値（§15-5-2）。
 *
 * 【実測の申し送り】54 は「回避可能」の幾何上の限界であって、**生存窓の下限 6f
 * （§15-7-2）を満たす限界ではない**。2px 刻みの実測では
 *   速度3.0: h=52 → 6f / h=54 → 2f     速度6.0: h=52 → 9f / h=54 → 5f
 * となり、**h=54 はどの速度でも 6f を下回る**。実用上の上限は **h=52**。
 * 型の上限は GDD の記述どおり 54 のままにしてあるが、h=54 を置いたステージは
 * 生存窓の下限検査で不合格になる（帯の検査が二重管理なしで捕まえる）。
 */
export const SPEAR_H_MIN = 40
export const SPEAR_H_MAX = 54
/** 実測で生存窓 6f を満たす実用上の上限（速度3.0 で 6f ちょうど） */
export const SPEAR_H_PRACTICAL_MAX = 52
/** 伸長フレーム数の範囲（既定 8 = 133ms） */
export const SPEAR_RISE_MIN = 6
export const SPEAR_RISE_MAX = 20
export const SPEAR_RISE_DEFAULT = 8
/** 伏せ状態の高さ 2px。非致死（地面と同じく踏める） */
export const SPEAR_IDLE_H = 2

// == G2 WALL の幾何規定（GDD §15-3） ======================================

/** h >= 56 を WALL と呼ぶ。56 = JUMP_APEX 52.08 + 4。単発では絶対に越えられない */
export const WALL_MIN_H = 56
/** 踏み台上からの実効上限。WALL の h <= 踏み台高さ + 40 */
export const WALL_STEP_HEADROOM = 40
/** 踏み台に要求する最低接地フレーム数。w1 >= 8 * 速度 - 10 の 8 */
export const WALL_STEP_MIN_GROUND_FRAMES = 8

// == G3 fly の速度域（GDD §15-4） =========================================

export const FLY_VX_MIN = 1.0
export const FLY_VX_MAX = 4.0
/** 252/(速度+vx) がこれを下回ると視覚確認が原理的に不成立（F1・不合格） */
export const FLY_LOOKAHEAD_MIN_FRAMES = 18
/** これを下回る配置は初見殺し扱い。ルールA・B が必須（F2・警告） */
export const FLY_LOOKAHEAD_WARN_FRAMES = 24

// == 新指標（GDD §15-7-3） ================================================

/**
 * 狭窓密度の対象となる生存窓のしきい値（GDD §15-14）。
 *
 * **固定 10f をやめ「その章の生存窓 下限 + 2f」にする。**
 * 固定値だと、下限が 11f の章では原理的に 0 にしかならず**指標が死ぬ**。
 * 指標が 0 にしかならないとき、疑うべきは配置ではなく指標である。
 */
export const TIGHT_WINDOW_MARGIN = 2
export function tightWindowThreshold(windowMinFrames: number): number {
  return windowMinFrames + TIGHT_WINDOW_MARGIN
}

/**
 * トゲ床の幅の上限（GDD §5-3 新設）。`8n <= 水平到達距離 x 0.85`。
 * トゲは**上面に乗れない唯一の高さ持ち障害物**で、幅を伸ばすほど窓が縮む。
 * 単一オブジェクトなので誤帰属距離は 0 のまま保てる。
 */
export const SPIKE_MAX_WIDTH_RATIO = 0.85

/**
 * 章ごとのステージ長の上限（秒）。**不合格条件**（GDD §15-15）。
 *
 * 長さは従属変数ではなく制約である。§8-3 でチェックポイントを置かない理由の3番目に
 * 「最長でも60秒」と書かれており、それを超えた時点でその前提が壊れる。
 * 憲法3 は「もう1回」の**意思決定**コストを下げるが**実行**コストは下げない。
 * 300ms で再開できても、90% 地点で死ねばその長さぶんの再実行が要る。
 * §9-2 の損失回避は取り戻せる範囲でだけ燃料になり、それを超えると諦めの理由に変わる。
 */
export const CHAPTER_MAX_SECONDS: readonly number[] = [40, 55, 60, 65, 70, 75]
/** S30 のみ例外的に 80 秒 */
export const FINAL_STAGE_MAX_SECONDS = 80

/** 同一 worldX 区間に重ねてよい着地可能面の数（本線＋迂回の2つまで。§5-3 新設） */
export const MAX_OVERLAPPING_SURFACES = 2
/** 同時に起動中になりうる崩落床の数の上限（§5-3 新設） */
export const MAX_CONCURRENT_CRUMBLE = 3

// == 配置上限（GDD §5-3） ==================================================

/** 谷の最小幅 24 px 固定 */
export const PIT_MIN_W = 24
/** 谷の最大幅 = 水平到達距離 x 0.90 */
export const PIT_MAX_RATIO = 0.9
/** 足場・ブロック間の最大距離 = 水平到達距離 x 0.92 */
export const GAP_MAX_RATIO = 0.92
/** 障害物の最大高さ 40 px */
export const OBSTACLE_MAX_H = 40
// == 検査（ステージソルバ・GDD 付録A 2026-09-21 追加 / §14） ==============

/**
 * 生存窓の計測方法。連続フレーム列の最大長で測り、非連続の和を取らない
 * （GDD §14-① 縛り a）。到達状態ごとに分けて測る（縛り b）。
 */
export const WINDOW_METRIC = 'contiguous-max-run' as const

/**
 * 最悪生存窓の警告しきい値 3 f (50 ms)（GDD §14-① 副1）。
 * 判定は「3f **以下**で警告」（GDD §14-10 / §14-11 履歴#10 で「未満」から改定）。
 * 3f = 50ms は人間の入力分解能の床であり、実質「見てから判断不能」であるため。
 */
export const WORST_WINDOW_WARN = 3

/**
 * 誤帰属距離 `MISATTRIB_GAP` の上限 = 0（GDD §14-8-3）。
 *
 * 詰み（勝利領域 W からの離脱）フレームから死亡フレームまでの間に、
 * 要求タップ地点を **1つでも通過していたら不合格**。
 *
 * 害は「時間の長さ」ではなく「間に成功体験が挟まること」である。
 *   障害物 k は越えた → 次の k+1 で死んだ → k+1 の跳び方を直そう（実際の原因は k）
 * この誤帰属は、詰んでから死ぬまでに「クリアした」と知覚するイベントを
 * 通過したときにのみ発生する。経過時間は無関係。
 */
export const MISATTRIB_GAP_MAX = 0

/**
 * 可制御詰み潜伏時間の**警告**しきい値 42 f (700 ms)（GDD §14-8-3）。
 * 詰んだ後にプレイヤーが接地して操作可能だったフレーム数の合計（強制滞空を除く）。
 * 誤帰属が無くても「詰んでいるのに操作させ続けている時間」は §9-5 の摩擦にあたる。
 * **不合格条件ではない。**
 */
export const DEADEND_CTRL_WARN = 42

/**
 * 素の詰み潜伏時間（詰み→死亡の単純な経過）は**判定に用いない**（GDD §14-8 / §14-11 履歴#11）。
 * 旧「詰み潜伏時間 42f 上限」は、跳びすぎで詰みに入る経路が必ず JUMP_AIRTIME=42f の
 * 強制滞空を含むため構造的に達成不能であり、企画 駆により撤回された。診断ログのみに使う。
 */
export const DEADEND_RAW_JUDGED = false

/**
 * これ以下の接地時間でつながるジャンプを「連鎖」とみなす 12 f (200 ms)。
 * 単純反応時間の下限が約 200ms であり、それ以下の再ジャンプは
 * 「着地してから状況を見て決める」ことが生理的に不可能＝事前決め打ちの連続入力である
 * （GDD §14-③）。
 */
export const CHAIN_GROUND_MAX = 12
/** 連鎖長の絶対上限 5（GDD §7-3 ルールD） */
export const CHAIN_MAX_GLOBAL = 5
/** 連鎖長4以上の直後に必要な接地区間 30 f (500 ms)（息継ぎ規定・GDD §14-③） */
export const BREATH_MIN = 30
/** 息継ぎ規定が発動する連鎖長 */
export const BREATH_TRIGGER_CHAIN = 4

/** 区間難度 D(t) のスライディング窓幅 2.0 s = 120 f（GDD §14-④） */
export const CLIMAX_WINDOW_FRAMES = 120
/** D(t) の正規化基準。JUMP_AIRTIME[frames]（GDD §14-④ の指定どおり 42 を使う） */
export const CLIMAX_NORM_FRAMES = 42

// == クライマックス位置（GDD §7-3 ルールE / §14-④） =======================

export const CLIMAX_MIN_RATIO = 0.85
export const CLIMAX_MAX_RATIO = 0.95

/**
 * 平均要求タップ/秒の**実効上限**を導くための、章ごとの抑制率上限。
 *
 * 抑制オブジェクト（跳んではいけない障害物）は**時間を消費してタップを生まない**。
 * したがって密度の上限は、理論最大（tapsPerSecondCeiling の最大 1.11 /秒）に
 * `(1 - 抑制率上限)` を掛けた値まで落ちる。章を追うごとに抑制率を上げる設計なので、
 * **密度の上限は章が進むほど下がる**。上げようとしていた2つの指標
 * （抑制率と密度）が互いを打ち消す関係にあった、ということ。
 */
export const CHAPTER_SUPPRESS_MAX: readonly number[] = [0.1, 0.2, 0.25, 0.3, 0.35, 0.4]

/**
 * 平均要求タップ/秒の**章ごとの設計帯**（GDD §15-16）。
 *
 * 旧「§6-3 の単一設計値 x 比率」は撤回された。S8 0.90 / S9 1.00 / S10 1.10 は
 * 実効上限（0.89）を超えており、いかなる配置でも到達できなかったため。
 *
 * **下限は暫定値**である。現行10本を不合格にしないために緩く置いてある。
 * これは甘くしたのではなく、**基準が未確定であることを数値の形で正直に表している**。
 * 章III の設計に入る前に必ず較正すること（企画 駆）。
 *
 * 参考（実効上限）: I 1.00 / II 0.89 / III 0.83 / IV 0.78 / V 0.72 / VI 0.67
 */
export const CHAPTER_TAPS_PER_SEC_BAND: readonly (readonly [number, number])[] = [
  [0.55, 0.8],
  [0.4, 0.7],
  [0.45, 0.75],
  [0.45, 0.72],
  [0.45, 0.68],
  [0.45, 0.65],
]

/**
 * 障害物 総数の**上限係数**（個/秒）。§6-3 の設計値（単一値）は撤回された。
 *
 * 誤帰属0を満たす最小間隔クラスは 1.12R（R = 滞空 41.67f x 速度）だから、
 * 1秒あたりに置ける本数は `60 / (1.12 x 41.67) = 1.286`。
 * **R に速度が含まれるため、上限は速度に依存しない。**
 * 下限は持たない（薄いこと自体は密度の検査で捕まえる）。
 *
 * これで「総数90 と 長さ55秒」のように**原理的に両立しない設計値**は書けなくなる。
 */
export const MIN_GAP_RATIO_NONLANDABLE = 1.12
export const MAX_OBJECTS_PER_SECOND = 60 / (MIN_GAP_RATIO_NONLANDABLE * JUMP_AIRTIME)

// == G5 drop / G6 fly 上下動（GDD §16-6・2026-09-22） ========================

/** OB-15 落ちる浮遊物 16x16 */
export const DROP_W = 16
export const DROP_H = 16
/** 予兆の揺れ: y ± 1px・周期 24f の三角波。stageFrame の純関数 */
export const DROP_SWAY_AMP = 1
export const DROP_SWAY_PERIOD = 24
/**
 * `drop` と `crumble` を同一 worldX 区間に置ける最小距離。
 * 「踏んで落ちる（crumble）／踏まなくても落ちる（drop）」の混同を避けるため、
 * ±320px（= 画面幅 1 枚ぶん）以内に共存させない（§16-6）。
 */
export const DROP_CRUMBLE_MIN_SEPARATION = 320

/** G6 飛行体の上下動。三角波・`amp = 0` で後方互換 */
export const FLY_AMP_MIN = 8
export const FLY_AMP_MAX = 24
export const FLY_PERIOD_MIN = 30
export const FLY_PERIOD_MAX = 90

// == 難易度モデル（GDD §16-7・最重要） ======================================

/**
 * タップ時間精度 σ [ms]。**唯一の外部実測量**。
 *
 * 【2026-09-22 改訂 40 → 30】
 * σ=40 は**合成誤差**を σ 1個で読んだ値だった。タップ誤差には2成分ある。
 *   ① ランダムなばらつき σ —— 習熟しても消えない
 *   ② 狙点のずれ（系統誤差）—— 試行とともに消える
 * 習熟途中のプレイヤーは**狙点そのものを知らない**ので ② が上乗せされる。
 * **学習コストが最小のステージから取るのが正しい手続き**で、新規性がほぼ無い
 * S1・S2 の実測（1死 / 3死）が σ=30 帯に素直に乗る。そこを基準にする。
 */
export const SIGMA_MS = 30
/** 頑健性の併記に使う3点。プレイヤーの精度差に対する感度を毎回可視化する */
export const SIGMA_POINTS: readonly number[] = [30, 40, 50]

/**
 * `E[D_skill]` が `D_actual` の目標に占めてよい割合（GDD §16-11）。
 *
 * 【旧「目標の 0.7〜1.6倍」は撤回】
 * `E[D_skill]` は**「完全に覚えた人が、なお死ぬ回数」**である。
 * 実際にプレイヤーが体験するのは**「覚えるまでの回数」** `D_actual` で、
 *
 *     D_actual = E[D_skill] + D_learn
 *
 * 実測では学習由来 `D_learn` が S1 20% → S2 67% → S4 96% を占めた。
 * **旧基準は体験の4%しか規定していなかった**ので、絶対帯から比率へ変える。
 *
 *  - 下限 5%: 「覚えたら二度と死なない」を防ぐ（**リプレイ価値**）
 *  - 上限 50%: 「覚えたのに運で死ぬ」を防ぐ（**憲法2「覚えれば必ず突破できる」**）
 */
export const SKILL_SHARE_LO = 0.05
export const SKILL_SHARE_HI = 0.5

/**
 * 生存窓の帯（GDD §16-2 が §15-7-4 を置き換える）。
 * **下限 6〜9f・上限は下限 + 6f。窓はもう難易度カーブを作らない。**
 * カーブを作るのは狭窓の本数（＝狭窓密度）のほう。
 */
export const WINDOW_MAX_MARGIN = 6

/**
 * 狭窓密度の**下限**（章ごと・本/秒）。旧値の3〜7倍。ここが実害の本体だった。
 * 旧値（0.00〜0.55）では10本合計の期待死亡回数が約0.5回にしかならず、
 * 社長が10本を無死亡で通り抜けた。
 *
 * 【2026-09-22 §16-10】**上限は撤廃した。**
 * `E[D]` の上限（目標の1.6倍）が入った時点で冗長になったため。
 * 総量は `E[D]`、集中しすぎは息継ぎとチェイン長上限が見ており、
 * 上限が担っていた役割は全部そちらへ移っている。
 * 上限が残っていると「長さ上限 x 密度上限」で狭窓の本数が頭打ちになり、
 * S5/S7/S8/S9 が目標死亡回数に届かなかった。
 */
export const CHAPTER_TIGHT_DENSITY_MIN: readonly number[] = [0.42, 0.34, 0.36, 0.38, 0.4, 0.42]

/**
 * 1ステージの狭窓のうち、**同一ユニット種が占めてよい上限**（GDD §16-10 #3）。
 *
 * 難易度の出所が1種類に偏ることを**構造として禁じる**。
 * プレイヤーの記憶に残るステージ像が「壁、壁、壁」になってはならない。
 * 旧 S6〜S10 は高速域で誤帰属0のまま 6f を作れるのが WALL しか無く、
 * 各本 10〜11 本の WALL に偏っていた。`GATE` の追加でこれが解消できる。
 */
export const TIGHT_UNIT_SHARE_MAX = 0.5

/**
 * `E[D_skill]` の**章合計**の許容幅（目標死亡回数の合計に対する比）。
 *
 * 各本が個別の帯に入っていても、**全本が下寄りなら章全体が易しくなる**。
 * 判定は個別と同じ「`D_actual` 目標の合計に対する `E[D_skill]` の合計の割合」で行う。
 */
export const CHAPTER_DEATH_SUM_LO = SKILL_SHARE_LO
export const CHAPTER_DEATH_SUM_HI = SKILL_SHARE_HI

/**
 * 知識由来の死 `D_knowledge` の上限（目標死亡回数に対する比）。
 * **1割**。「いじわるは味付けであって主菜ではない」（企画 駆）。
 * 初見でしか効かない死に頼ると、覚えた瞬間に急に簡単になってフローが崩れる。
 */
export const KNOWLEDGE_DEATH_RATIO = 0.1

/**
 * `GATE` の垂直クリアランス `B` の下限（GDD §16-10 / 彩色 映 R19）。
 *
 * **`B` は見た目の隙間ではなく、致死ボックス（13px）が収まるべきクリアランス。**
 * 画面上の開口 = `13 + B` px。`B = 3` で開口 16px ＝ スプライト高ぴったりになる。
 *
 * 下限の理由は視覚ではなく**判定への信頼**である。判定外に置いたアンテナ（上2px）と
 * つま先（下1px）の計3px が `B < 3` では毎回どちらかにめり込む。かすっても死なないのは
 * 設計どおりだが、**毎回めり込んで生きているのは「当たっているのに死なない」に見え、
 * 判定への信頼を削る**。
 *
 * **例外は無い。`B = 2` も不合格。**（企画 駆が彩色 映の「既習区間のみ」を潰した）
 * §4-1 の理不尽2型のうち **過少検出（明らかに当たったのに生きてる）** を毎回起こすため。
 * 憲法2 が成立するのはプレイヤーが判定を信じているときだけで、信頼が崩れれば
 * **その後のすべての死が「判定のせい」に帰属しうる**。例外を作ると過少検出の
 * 発生箇所が管理不能になる。失うのは 8.2f の1段だけで、6f は別の組み合わせで作れる。
 *
 * 上限 12 は開口 25px。これ以上広げても窓が緩くなるだけで門として機能しない。
 */
export const GATE_B_MIN = 3
export const GATE_B_MAX = 12
