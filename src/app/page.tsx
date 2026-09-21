import GameClient from './_game/GameClient'

/**
 * ゲームのマウント点。
 *
 * 画面は TITLE / SELECT / PLAY / 死亡演出 / RESULT のすべてを canvas に描くため、
 * DOM 側に置くものは canvas 1 枚だけ。`GameClient` は `use client` の
 * クライアントコンポーネントで、マウント後に再レンダリングされない（GDD §12-2）。
 *
 * 静的エクスポート（`output: 'export'`）のためサーバ側の処理は持たない。
 */
export default function Home() {
  return <GameClient />
}
