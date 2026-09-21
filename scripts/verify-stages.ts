/**
 * JumpOrDie — ステージ検査スクリプト
 *
 * 出典: GDD §7-4（検査9項目）/ §14（実装フェーズでの確定事項）/ §12-6（決定論）
 *
 * 実行: npm run verify:stages （npm run build の prebuild でも自動実行）
 *
 * > すべてのステージは、機械的に「突破可能である」ことを
 * > 証明してから出荷すること。（GDD §7-4）
 *
 * 不合格が1件でもあれば exit code 1 を返す。
 */

import { STAGES, getBudget } from '../src/data/stages'
import { checkDeterminism, verifyStage } from '../src/lib/game/solver'
import { horizontalReach } from '../src/lib/game/physics'
import { goalFrame } from '../src/lib/game/stageRuntime'
import {
  BREATH_MIN,
  CHAIN_GROUND_MAX,
  DEADEND_CTRL_WARN,
  MISATTRIB_GAP_MAX,
  WORST_WINDOW_WARN,
} from '../src/lib/game/constants'

const ms = (f: number) => Math.round((f * 1000) / 60)
const pc = (r: number) => `${(r * 100).toFixed(1)}%`

let failed = 0

console.log('=== JumpOrDie ステージソルバ検査 (GDD §7-4 / §14) ===')
console.log(
  `指標: 生存窓=連続フレーム列の最大長・到達状態ごと / 主指標=マキシミン経路の最小生存窓 / ` +
    `連鎖=接地 ${CHAIN_GROUND_MAX}f 以下 / 息継ぎ ${BREATH_MIN}f / ` +
    `誤帰属距離 上限 ${MISATTRIB_GAP_MAX} / 可制御詰み潜伏 警告 ${DEADEND_CTRL_WARN}f\n`,
)

for (const stage of STAGES) {
  const budget = getBudget(stage.id)
  if (!budget) {
    console.log(`S${stage.id}: §6-3 の検査基準が未定義です`)
    failed++
    continue
  }

  const t0 = Date.now()
  const r = verifyStage(stage, budget)
  const elapsed = Date.now() - t0
  const s = r.solve

  console.log(`--- S${stage.id} ${r.stageName} ---`)
  console.log(
    `  速度 ${stage.speedPxPerFrame} px/f / 長さ ${stage.lengthPx}px / ` +
      `水平到達 ${horizontalReach(stage.speedPxPerFrame)}px / ゴール ${goalFrame(stage)}f`,
  )
  console.log(`  [1] 突破可能性     : ${s.feasible ? 'OK 突破可能' : 'NG 突破不能'}`)

  if (s.feasible) {
    console.log(
      `      クリア         : ${s.frames}f (${(s.frames / 60).toFixed(2)}s) / タップ ${s.taps} 回`,
    )
    console.log(
      `  [2/3] 主指標 最小生存窓 : ${s.minWindow}f (${ms(s.minWindow)}ms) @ ${pc(s.minWindowAt)}` +
        `  [帯 ${budget.windowMinFrames}〜${budget.windowMaxFrames}f${stage.id === 1 ? ' / 上限は S1 除外' : ''}]`,
    )
    console.log(
      `  [4] 最悪生存窓     : ${s.worstWindow}f (${ms(s.worstWindow)}ms) @ ${pc(s.worstWindowAt)}` +
        `  [警告しきい値 ${WORST_WINDOW_WARN}f]`,
    )
    console.log(
      `  [5] 誤帰属距離     : ${s.maxMisattribGap} 地点  [上限 ${MISATTRIB_GAP_MAX}] ` +
        `${s.maxMisattribGap > MISATTRIB_GAP_MAX ? 'NG' : 'OK'}`,
    )
    console.log(
      `  [5b] 可制御詰み潜伏 : ${s.maxDeadEndCtrl}f (${ms(s.maxDeadEndCtrl)}ms)  [警告 ${DEADEND_CTRL_WARN}f 超] ` +
        `/ 素の値 ${s.maxDeadEndRaw}f (${ms(s.maxDeadEndRaw)}ms・判定に用いない)`,
    )
    console.log(
      `  [7] 最大チェイン長 : ${s.maxChain}  [上限 ${budget.maxChain}] / 息継ぎ違反 ${s.breathViolations.length} 件`,
    )
    console.log(
      `  [10-12] 狭窓密度 ${s.tightDensity.toFixed(3)} [帯 ${budget.tightDensity.join('〜')}] / ` +
        `抑制率 ${s.suppressRatio.toFixed(3)} [帯 ${budget.suppressRatio.join('〜')}] / ` +
        `複合度 ${s.compositeRatio.toFixed(3)} [帯 ${budget.compositeRatio.join('〜')}]`,
    )
    console.log(
      `  [9] クライマックス : D(t)max=${s.climaxD.toFixed(2)} @ ${pc(s.climaxAt)}  [帯 85.0〜95.0%${budget.climaxWarnOnly ? ' / S1 は警告のみ' : ''}]`,
    )
    console.log(
      `      推奨ルートの窓 : ${s.route.map((j) => j.window).join(', ')}`,
    )
    console.log(
      `      接地時間       : ${s.route.map((j) => j.groundedFrames).join(', ')}`,
    )
    // §14-9 / §14-12 #4: 窓が「連続フレーム列の最大長」であることの証跡
    const discontinuous = s.route.filter((j) => j.runCount > 1)
    console.log(
      `      窓の連続性     : 全 ${s.route.length} 本中、有効タップ区間が1本のもの ` +
        `${s.route.length - discontinuous.length} 本 / 複数に割れたもの ${discontinuous.length} 本` +
        `（窓は最長の1本の長さで、合算ではない）`,
    )
    const sample = s.route.find((j) => j.window === s.minWindow) ?? s.route[0]
    console.log(
      `      窓の実体(最小) : #${sample.index} 窓 ${sample.window}f = 連続区間 [f${sample.first}..f${sample.last}] ` +
        `(last-first+1 = ${sample.last - sample.first + 1}) / 区間数 ${sample.runCount}`,
    )
    if (discontinuous.length > 0) {
      console.log(
        `      割れた窓の内訳 : ${discontinuous
          .map((j) => `#${j.index}(${j.runCount}区間→窓${j.window}f)`)
          .join(', ')}`,
      )
    }
    const tight = [...s.route]
      .sort((a, b) => a.window - b.window)
      .slice(0, 3)
      .map((j) => `#${j.index} ${j.window}f@${pc(j.at)}`)
    console.log(`      厳しい順 上位3 : ${tight.join(' / ')}`)
  }

  // 決定論の回帰テスト（GDD §12-6）
  const det = checkDeterminism(
    stage,
    s.route.map((j) => j.frame),
  )
  console.log(`      決定論再現性   : ${det ? 'OK 2回再生で完全一致' : 'NG 不一致'}`)
  if (!det) failed++

  console.log(
    `      探索           : 状態 ${s.statesExplored.toLocaleString()} / 到達状態 ${s.arrivalsAnalyzed.toLocaleString()} (${elapsed}ms)`,
  )

  if (r.issues.length === 0) {
    console.log('      指摘           : なし')
  } else {
    for (const i of r.issues) console.log(`      [${i.level}] ${i.code}: ${i.message}`)
  }
  if (!r.ok) failed++
  console.log('')
}

if (failed > 0) {
  console.log(`=== 検査 不合格: ${failed} 件 ===`)
  process.exit(1)
}
console.log('=== 全ステージ 検査合格 ===')
