/**
 * renderState.ts — 描画層とエンジン層をつなぐインターフェース契約
 *
 * ============================================================================
 *  透A への申し送り（統合時に読むところ）
 * ============================================================================
 *
 * ・依存方向は **エンジン → 描画の一方通行** です。描画層は `src/lib/game/` を
 *   一切 import しません。統合時は、エンジン側の状態から本ファイルの `RenderState`
 *   を毎フレーム組み立てて `drawFrame(ctx, state)`（draw.ts）に渡してください。
 * ・`RenderState` は「その 1 フレームを描くのに必要な情報の全部」です。
 *   毎フレーム新しいオブジェクトを作っても、使い回しの 1 個を書き換えても構いません
 *   （描画層は state を保持しません）。
 * ・座標はすべて **320×180 の論理座標**。float で渡して構いません（描画直前に
 *   描画層が Math.round します）。物理を整数に丸めないでください（GDD §12-3）。
 * ・**アニメの位相はすべて frame 由来**です。`Date.now()` / `Math.random()` を
 *   渡さないでください（GDD §12-6 決定論）。
 *
 * --- フィールド早見表 ---------------------------------------------------------
 *  phase          画面フェーズ。何を描くかの分岐
 *  stageFrame     ステージ開始からの経過フレーム（リトライで 0 に戻る）。
 *                 飛行体の羽ばたき等、ステージ内アニメの位相に使う
 *  uiFrame        起動からの通算フレーム（**リセットしない**）。
 *                 `TAP` などの UI 点滅（30f ON / 30f OFF）に使う
 *  cameraX        画面左端 x=0 に対応する世界座標。描画カリングと座標変換に使う
 *  reducedFlash   true なら反転点滅を静止縁取りに差し替える（GDD §10-3）
 *  touchDevice    true なら TITLE の `SPACE / CLICK` を出さない
 *  player         プレイヤーの描画情報
 *  obstacles      画面に描く可能性のある障害物（カリング前でも可）
 *  stage          ステージ情報（地面・谷・ステージ名）。
 *                 **地面の模様は id から機械的に決まる**（`chapterOf(id)`）。
 *                 旧 `tilePattern` は廃止したので、渡さないこと
 *  hud            HUD 帯の情報
 *  death          死亡演出の情報（死んでいなければ null）
 *  exitPrompt     離脱導線 `← STAGES` の表示段階（省略可・既定 HIDDEN）。
 *                 READY でアイドル 90f のときだけ `ST nn` と差し替えて出る。
 *                 段階の求め方は描画層の `exitPromptPhaseOf(idleFrames)` を使うこと。
 *                 タップ判定の矩形は `exitTapRegion(scale)`、受付可否は
 *                 `isExitTapAccepted(phase)` で取れる（しきい値を二重に持たないため）
 *  readyMessage   READY フェーズに 1 行だけ出す死亡メッセージ（かな）。無ければ null
 *  readyUnlock    解放通知 2 行（['STAGE 04', 'UNLOCKED']）。無ければ null
 *  banner         `STAGE 1` / `GO!` / `PRACTICE` の一時表示。無ければ null
 *  title          TITLE 画面の情報（phase === 'TITLE' のときのみ参照）
 *  select         STAGE SELECT の情報（phase === 'SELECT' のときのみ参照）。
 *                 30 本対応で章タブ方式になった。**選択中の章の 5 件だけ**を渡すこと。
 *                 タブの矩形は `chapterTabRect(i)`、枠の矩形は `selectCardRect(i)` で取れる
 *  result         RESULT の情報（phase === 'RESULT' のときのみ参照）
 * ----------------------------------------------------------------------------
 */

/**
 * 画面フェーズ。
 * - `TITLE`   タイトル（HUD 帯は出さない）
 * - `SELECT`  ステージセレクト（第3幕は S1–S3 の 3 枠のみ）
 * - `READY`   待機。走行コマAで静止し、`TAP` 点滅＋死亡メッセージ 1 行
 * - `PLAY`    プレイ中
 * - `HITSTOP` 死亡直後 6f。全停止し、殺した障害物 1 個だけを反転点滅
 * - `BURST`   死亡 11f。プレイヤーを消してドット片 4 個を飛散
 * - `RESULT`  ステージクリア時のみ出る唯一のリザルト画面
 */
export type RenderPhase = 'TITLE' | 'SELECT' | 'READY' | 'PLAY' | 'HITSTOP' | 'BURST' | 'RESULT'

/**
 * 障害物の種類。GDD §5-1 のカタログ全 10 種に 1:1 対応。
 * `PIT` は専用スプライトを持たず、地面を描かない区間として表現されるため、
 * 描画は `stage.pits` 側で行う（obstacles に混ぜても描画上は無視される）。
 */
export type RenderObstacleKind =
  | 'BLOCK_S' // OB-01 ブロック小 12×16
  | 'BLOCK_L' // OB-02 ブロック大 24×32
  | 'PIT' // OB-03 谷（地形）
  | 'CEILING' // OB-04 天井 16×16 タイル反復
  | 'PLATFORM' // OB-05 浮遊足場 32×8（幅可変・3スライス）
  | 'SPIKE' // OB-06 トゲ 8×8 反復
  | 'LIFTER' // OB-07 昇降ブロック 16×16（y が動く）
  | 'FLYER' // OB-08 飛行体 12×12・2コマ（MID/HIGH ＝ 鳥）
  | 'CRUMBLE' // OB-09 崩落床 24×8・3コマ
  | 'SPRING' // OB-10 バネ 12×8 /12×16・2コマ
  // --- ステージ拡張（GDD §15 / 指示書 §7A・R16）---
  | 'BLOCK' // 汎用ブロック（w×h 可変）。**h ≥ 56 なら描画層が自動で WALL 表現に切り替える**
  | 'SWING' // OB-11 横振りブロック 16×16。判定は block と同一・四隅を面取り
  | 'SPEAR' // `spear`。伏せ（非致死・GB2）と伸長（致死・GB1）を frame で切り替える
  | 'MOUSE' // `fly` LOW（地上型）12×12・2コマ。左へ走る
  // G5 落下物 16×16。**`OB_CEILING`(SP-08) を流用（新規素材 0）**。GB1 ベタ・上面 GB3 なし。
  // 落ちる個体と落ちない個体は**同一スプライト**。落ちる個体だけが落下前に y±1px・
  // 周期24f で揺れる（`dropWobbleOffset()`。落下開始と同時に揺れを止めること）。
  // `crumble`(GB2・踏める) とは階調だけで区別できる。w / h は 16 を渡すこと。
  // **`falls` / `tell` は描画層に渡さない**（渡さないことが「予兆ありと予兆なしが
  // 1ドットも違わない」ことの構造的な保証になる）。揺れは y に織り込んで渡すこと
  | 'DROP'

/** 描画対象の障害物 1 個 */
export interface RenderObstacle {
  /** 一意な ID。死亡演出で「どれが殺したか」を指すのに使う */
  id: number
  kind: RenderObstacleKind
  /** 左端の世界座標（画面 x = worldX - cameraX） */
  worldX: number
  /**
   * 上端の画面 y。**動体はすべて「現在位置」を入れること**
   * （LIFTER / FLYER / MOUSE / SWING / DROP）。
   *
   * **揺れ・上下動・落下を描画層側で足すことは無い。** ここに入った値がそのまま描かれる。
   * 詳細は下の「位置が動く障害物と、判定の一致について」を読むこと。
   */
  y: number
  /** 幅（px）。反復系（CEILING / SPIKE / PLATFORM）はここで全長を渡す */
  w: number
  /** 高さ（px） */
  h: number
  /**
   * コマ指定。省略時は stageFrame から描画層が決める。
   * - CRUMBLE: 0 = 無傷 / 1 = ひび1 / 2 = ひび3
   * - SPRING : 0 = 縮み / 1 = 伸び（接触後 6f）
   * - FLYER / MOUSE: 省略推奨（描画層が floor(stageFrame/6)%2 で決める）
   * - **SPEAR: 0 = 伏せ（非致死・GB2）/ 1 = 伸長開始以降（致死・GB1）。**
   *   これが階調を決める唯一の入力で、`h` は大きさだけを決める。【P0】の詳細は下記。
   */
  frame?: number
  /** true なら描かない（崩落床が 10f で消滅した後など） */
  hidden?: boolean
}

/**
 * ============================================================================
 *  位置が動く障害物と、判定の一致について（G5 `drop` / G6 `fly` 上下動）
 * ============================================================================
 *
 * ■ 「判定域の画素を 2 コマで 1px も変えない」規定との関係 —— **抵触しない。**
 *
 * あの規定が禁じているのは **スプライト内部の画素がアニメのコマで変わること**である。
 * 判定はスプライト内の固定オフセットで定義されているため、コマで中身が変わると
 * 「羽が下がっている時は当たらない」という**嘘の学習**が起きる。
 *
 * `drop` の揺れも `fly` の上下動も、変わるのは**オブジェクトの位置**であって
 * スプライト内部の画素ではない。**判定は位置ごと一緒に動く**ので、
 * 見た目と判定の対応は 1px も崩れない。したがって規定違反ではない。
 *
 * ■ ただし、**嘘になる条件が 1 つだけある。**
 *
 * > **揺れ・上下動を「描画層が独自に足す」と、その瞬間に嘘になる。**
 *
 * 描画だけが ±1px 動いて判定が動かなければ、**黒い所に当たっていないのに死ぬ**
 * （あるいはその逆）が生まれる。これは §3-3 の過検出と同型で、憲法2 に直接抵触する。
 *
 * **したがって描画層は、位置のオフセットを一切自前で足さない。**
 * `y` に入ってきた値をそのまま描く。揺れも上下動も落下も、**エンジン側が
 * `y` を決める段階で織り込むこと。**
 *
 * ■ 【実装上の注意】**丸めは 1 回だけにすること。**
 *
 * `drop` の予兆は ±1px しかない。エンジンが float の `y` で判定し、描画層が
 * `Math.round()` するという分業にすると、**同じフレームで判定と描画が最大 0.5px ずれ、
 * 1px の予兆が 0px に潰れたり 2px に見えたりする。**
 * 揺れ・上下動のオフセットは **整数で求め、その整数を判定にも `y` にも使う**こと。
 * 描画層が公開している `dropWobbleOffset()` / `flyVerticalOffset()` は
 * **整数を返す**ので、両方でこれを使えばずれは構造的に起こらない。
 */

/**
 * ============================================================================
 *  【P0】`spear` の描き方 — 色が変わる瞬間と致死になる瞬間を 1 フレームも違えない
 * ============================================================================
 *
 * `spear` は本作で唯一、**同一オブジェクトが非致死と致死を行き来する**障害物です。
 * 階調の切り替えタイミングが、そのまま憲法2（自己帰属）の実装になります。
 *
 * | frame | 状態                 | 階調 | `h`（＝現在の視覚高さ）        |
 * |-------|---------------------|------|------------------------------|
 * | `0`   | 伏せ（**非致死・踏める**）| GB2  | 常に 2                        |
 * | `1`   | 伸長中〜最大高（**致死**）| GB1  | `max(2, round(H(f)))` の現在値 |
 *
 * ・**`riseStart` と同一フレームで `frame` を 0 → 1 にすること。** 1 フレームでも遅れると
 *   「黒くないのに死ぬ」フレームが生まれ、ルールA が嘘になります。
 * ・逆に `H(f) = 0`（まだ伸びていない）の間も `frame = 1` にすること。判定は既に立っています。
 *   **判定が先に立って見た目が後から追いつくのは過検出と同型の理不尽です。**
 * ・`h` には**最大高ではなく現在の視覚高さ**を渡してください（40〜52 の固定値を決め打ちしない）。
 * ・**判定と描画を同じ式から出すため、描画層の `spearVisualHeight()` / `spearIsLethal()` を
 *   エンジン側でも使ってください**（しきい値を二重に持たない）。
 */

/** プレイヤーの描画情報。x は 56 固定（GDD 付録A）なので渡さない */
export interface RenderPlayer {
  /** スプライト上辺の画面 y（float 可） */
  y: number
  /** 走行 / 上昇 / 下降。READY は 'RUN' を渡すと走行コマAで静止する */
  motion: 'RUN' | 'RISE' | 'FALL'
  /** 走行コマの切替に使う世界座標（floor(worldX/12)%2。時間ではなく距離） */
  worldX: number
  /** BURST 中は false にしてプレイヤーを消す */
  visible: boolean
}

/** 谷（OB-03）の区間。地面タイルを描かない範囲 */
export interface RenderPit {
  /** 左端の世界座標 */
  worldX: number
  /** 幅（px） */
  w: number
}

/** ステージ情報 */
export interface RenderStage {
  /** 1–10 */
  id: number
  /** `FIRST STEP` などの英字大文字名。HUD には出さない（セレクト画面専用） */
  name: string
  /** ステージ全長（px）。進捗の分母 */
  lengthPx: number
  /** 地面上面 y。通常 148 固定 */
  groundY: number
  /**
   * 谷の区間一覧。
   *
   * ※ 地面の模様は **`id` から機械的に決まります**（章 = `Math.floor((id - 1) / 5)`）。
   *   **ステージデータに背景指定を持たせないでください**（章とパターンがずれた状態を
   *   作れてしまうため・指示書 §7A-5）。旧 `tilePattern` は廃止しました。
   */
  pits: readonly RenderPit[]
}

/** HUD 帯（y 0–11）の情報 */
export interface RenderHud {
  /** ステージ番号 1–10。`ST 01` と 2 桁ゼロ埋めで描く */
  stageNo: number
  /** 現在の到達率 0–1 */
  progress: number
  /** 自己ベスト到達率 0–1。無ければ null */
  best: number | null
  /** 直近 5 回の死亡マーカー（0–1）。新しい順・古い順どちらでもよい */
  marks: readonly number[]
  /** 試行回数。`× 41`（ゼロ埋めなし・右揃え） */
  attempts: number
  /** 練習モード（本幕スコープ外）。true なら `× 41` を `PRACTICE` に差し替える */
  practice?: boolean
}

/** 死亡演出の情報 */
export interface RenderDeath {
  /** 殺した障害物の id。落下死など該当なしは null */
  killerId: number | null
  /** 到達率 0–100（生値でよい。描画時に小数第1位へ切り捨てる） */
  reachPct: number
  /** 自己ベスト更新なら true（`NEW BEST 87.4%` に差し替わる） */
  newBest: boolean
  /** 死亡フレームからの経過（0 始まり）。演出の位相はすべてこれで決まる */
  frame: number
}

/**
 * 離脱導線 `← STAGES` の表示段階（スタイルガイド §6-3-1 / 改訂 R9）。
 *
 * `READY` でタップが 90f（1.5秒）無いときに、HUD 左端の `ST nn` と**差し替えて**出す。
 * アイドルの計測はエンジン層の担当。描画層は「今どの段階か」を受け取って描くだけ。
 * 段階の対応表（アイドル 90f 到達を +0f とする）:
 *
 * | 段階       | 経過      | 見え方              | タップ |
 * |-----------|-----------|---------------------|--------|
 * | `HIDDEN`  | –         | `ST nn` を出す      | 不可   |
 * | `FADE_25` | +0 – +5f  | GB3・25% ディザ     | 不可   |
 * | `FADE_50` | +6 – +11f | GB3・50% 市松ディザ | 不可   |
 * | `SOLID`   | +12 – +17f| GB3 ベタ            | 不可   |
 * | `ACTIVE`  | +18f 〜   | GB3 ベタ            | **可** |
 *
 * `SOLID` から `ACTIVE` までの 6f は、出現と同時に押してしまう事故を防ぐ意図的な猶予。
 * **この 6f を詰めないこと。**
 *
 * 経過フレームから段階を求めるには描画層の `exitPromptPhaseOf(idleFrames)` を使える
 * （しきい値を二重管理しないため、そちらを呼ぶことを推奨）。
 * キャンセル時は**フェードアウトを作らず** `HIDDEN` に戻す（1 フレームで消える）。
 */
export type ExitPromptPhase = 'HIDDEN' | 'FADE_25' | 'FADE_50' | 'SOLID' | 'ACTIVE'

/** 一時表示のバナー（`STAGE 1` → `GO!` → プレイ開始） */
export interface RenderBanner {
  /** 英字大文字。`STAGE 1` / `GO!` / `PRACTICE` */
  text: string
}

/** TITLE 画面 */
export interface RenderTitle {
  /** 通算死亡回数。0 なら表示しない（初回は非表示） */
  totalDeaths: number
  /**
   * タップのばらつき σ（**ミリ秒・整数**）。タイトル最下部に `TAP ±31MS` として 1 行だけ出す。
   *
   * **未測定は `null`（または省略）。`0` は未測定ではない。**
   * `0` は「ばらつきが 0 だった」という測定値なので `TAP ±0MS` と描く。
   * しきい値（100 タップ）未満のときは値ではなく `null` を渡すこと
   * —— `0` と区別できないと `TAP ±0MS` が出てしまう。
   *
   * 未測定のときの表示は **`TAP --`**。**`MS` は付けない**（値が無いのだから単位も付かない）。
   *
   * ■ この表示に**足してはならないもの**（UIテキスト25章の禁止事項）
   * - **前回比・差分・矢印を出さない。** 機械が改善を指差した瞬間に、それは称賛になる
   * - **ラベルを `TAP` 以外にしない。** `PRECISION` にした瞬間、主語が「あなたの精度」へ
   *   移って事実ではなくなる。**この表示が事実であるための唯一の条件**
   * - **σ にマイルストーンを作らない。** 出来事の累積と能力の値は別のもの
   * - **HUD・死亡時・RESULT に出さない。** 失敗の直後に出せば、その失敗への判定になる
   * - **強調も点滅も付けない。** この表示は何も足さないことによってのみ成立している
   */
  tapSigmaMs?: number | null
  /** `SFX ON` / `SFX OFF` */
  sfxOn: boolean
  /** `FLASH ON` / `FLASH OFF`（reducedFlash のトグル表示） */
  flashOn: boolean
}

/** ステージセレクトの 1 枠 */
export interface RenderSelectEntry {
  /** 1–10 */
  no: number
  /** 英字大文字。未解放では描かない */
  name: string
  /** LOCKED = 未解放 / OPEN = 解放済み未クリア / CLEARED = クリア済み */
  state: 'LOCKED' | 'OPEN' | 'CLEARED'
  /** 自己ベスト到達率 0–100。未プレイは null（`--`） */
  bestPct: number | null
  /** ベストタイム（ms）。クリア済みのときだけ使う */
  bestTimeMs: number | null
}

/**
 * STAGE SELECT 画面（30 本対応・章タブ方式。GDD §15-9-2 / 指示書 §7A-6）。
 *
 * ※ 章まわりの 4 項目は**統合中の取りこぼしで画面が落ちないよう省略可**にしてあるが、
 *   30 本対応では**必ず渡すこと**（省略時は章I・全章未解放・0/5・DEATHS 0 として描く）。
 *
 * 30 枠は 320×180 に入らないため、**章タブ 6 個 ＋ 選択中の章の 5 枠**で構成します。
 * 章は `Math.floor((stageId - 1) / 5)`。描画層の `chapterOf()` を使ってください。
 */
export interface RenderSelect {
  /**
   * **選択中の章の 5 件だけ**を、ステージ番号の昇順で渡すこと。
   * 実在しないステージは渡さない（渡された件数ぶんだけ枠を描く）。
   */
  entries: readonly RenderSelectEntry[]
  /** 選択中の章 0–5（I–VI） */
  chapter?: number
  /** 各章が解放済みか。長さ 6。未解放タブは地 GB2・文字 GB3 で描かれ、選択できない */
  chapterUnlocked?: readonly boolean[]
  /** 選択中の章のクリア本数 0–5（分母は常に 5 固定） */
  clearedInChapter?: number
  /** 選択中の章の総死亡回数。ゼロ埋めしない・カンマなし。未プレイでも `0` を出す */
  deathsInChapter?: number
  /** 練習モードの凡例 `HOLD = PRACTICE` を出すか。本幕は false */
  showPracticeHint?: boolean
}

/** RESULT（ステージクリア時のみ） */
export interface RenderResult {
  /** 初クリアなら `FIRST CLEAR` / `ついに。` に差し替わる */
  firstClear: boolean
  /** クリアタイム（ms）。`00:41.32` 形式で描く */
  timeMs: number
  /** ベストタイム更新なら `TIME` ラベルが `NEW RECORD` になり値が反転点滅する */
  newRecord: boolean
  /** このステージでの通算死亡回数 */
  deaths: number
  /** 解放したステージ番号。無ければ null（`STAGE 04` / `UNLOCKED` 2 行） */
  unlockedStageNo: number | null
  /** 全ステージ制覇なら true（`ALL CLEAR` / `ぜんぶ おぼえた。`） */
  allClear: boolean
}

/** 1 フレームを描くのに必要な情報の全部 */
export interface RenderState {
  phase: RenderPhase
  /** ステージ開始からの経過フレーム（リトライで 0） */
  stageFrame: number
  /** 起動からの通算フレーム（リセットしない）。UI 点滅用 */
  uiFrame: number
  /** 画面左端 x=0 に対応する世界座標 */
  cameraX: number
  /** 点滅演出を差し替える（GDD §10-3） */
  reducedFlash: boolean
  /** タッチ端末なら TITLE の `SPACE / CLICK` を出さない */
  touchDevice: boolean

  player: RenderPlayer
  obstacles: readonly RenderObstacle[]
  stage: RenderStage
  hud: RenderHud

  death: RenderDeath | null
  /**
   * 離脱導線 `← STAGES` の表示段階。**省略時は `HIDDEN`**。
   * `READY` 以外のフェーズでは描画層が無条件に無視する（`RUNNING` 中は描かない絶対規定）。
   */
  exitPrompt?: ExitPromptPhase
  /** READY に 1 行だけ重ねる死亡メッセージ（かな・分かち書き） */
  readyMessage: string | null
  /** 解放通知 2 行 */
  readyUnlock: readonly [string, string] | null
  banner: RenderBanner | null

  title?: RenderTitle
  select?: RenderSelect
  result?: RenderResult
}
