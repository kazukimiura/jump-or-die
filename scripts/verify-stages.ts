/**
 * JumpOrDie — ステージ検査スクリプト
 *
 * 出典: GDD §7-4（ステージソルバ）/ §12-6（決定論の保証）
 *
 * 実行: npx tsx scripts/verify-stages.ts
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

const f2ms = (f: number) => Math.round((f * 1000) / 60)

let failed = 0

console.log('=== JumpOrDie ステージソルバ検査 (GDD §7-4) ===\n')

for (const stage of STAGES) {
  const budget = getBudget(stage.id)
  if (!budget) {
    console.log(`S${stage.id}: §6-3 の検査基準が未定義です`)
    failed++
    continue
  }

  const t0 = Date.now()
  const r = verifyStage(stage, budget)
  const ms = Date.now() - t0
  const s = r.solve

  console.log(`--- S${stage.id} ${r.stageName} ---`)
  console.log(
    `  速度 ${stage.speedPxPerFrame} px/f / 長さ ${stage.lengthPx}px / ` +
      `水平到達 ${horizontalReach(stage.speedPxPerFrame)}px / ゴール ${goalFrame(stage)}f`,
  )
  console.log(`  突破可能性     : ${s.feasible ? 'OK 突破可能' : 'NG 突破不能'}`)

  if (s.feasible) {
    console.log(
      `  クリア         : ${s.frames}f (${(s.frames / 60).toFixed(2)}s) / タップ ${s.taps} 回`,
    )
    console.log(
      `  最小タップ窓   : ${s.minWindow}f (${f2ms(s.minWindow)}ms) @ 到達率 ` +
        `${(s.minWindowAt * 100).toFixed(1)}%  [下限 ${budget.minTapWindowFrames}f]`,
    )
    console.log(`  最大チェイン長 : ${s.maxChain}  [上限 ${budget.maxChain}]`)

    console.log(
      `  各タップの窓   : ${s.jumps.map((j) => j.windowFrames).join(', ')}`,
    )
    console.log(
      `  参考(最遅経路) : 最小 ${s.strictMinWindow}f / ${s.strictWindows.join(', ')}`,
    )
    const tight = [...s.jumps]
      .sort((a, b) => a.windowFrames - b.windowFrames)
      .slice(0, 3)
      .map((j) => `#${j.index} ${j.windowFrames}f@${(j.at * 100).toFixed(1)}%`)
    console.log(`  厳しい順 上位3 : ${tight.join(' / ')}`)
  }

  // 決定論の回帰テスト（GDD §12-6）
  const det = checkDeterminism(stage, s.solutionTapFrames)
  console.log(`  決定論再現性   : ${det ? 'OK 2回再生で完全一致' : 'NG 不一致'}`)
  if (!det) failed++

  console.log(`  探索状態数     : ${s.statesExplored.toLocaleString()} (${ms}ms)`)

  if (r.issues.length === 0) {
    console.log('  指摘           : なし')
  } else {
    for (const i of r.issues) {
      console.log(`  [${i.level}] ${i.code}: ${i.message}`)
    }
  }
  if (!r.ok) failed++
  console.log('')
}

if (failed > 0) {
  console.log(`=== 検査 不合格: ${failed} 件 ===`)
  process.exit(1)
}
console.log('=== 全ステージ 検査合格 ===')
