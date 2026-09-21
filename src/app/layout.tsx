import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * ルートレイアウト。
 *
 * メタデータは UIテキスト §8 の確定文をそのまま使う（画面外なので文字数制約の対象外）。
 * Web フォントは読み込まない。画面の文字はすべて描画層のドットフォント（画像スプライト）で
 * 描くため、フォント読み込みの遅延・FOUT は構造的に発生しない（GDD §12-4）。
 *
 * ============================================================================
 *  【重要】このページは AdSense Auto ads を **意図的に読み込まない**
 * ============================================================================
 *
 * kzkmr.net は Auto ads を全サイト標準で入れる方針だが、**本ページだけが例外**である。
 * 入れ忘れではないので、復活させないこと。
 *
 * 理由（社長裁定 2026-09-21 / 第4幕 品質検査 C-1）:
 *
 *  1. **広告枠が1つも無い。** 本作は TITLE / SELECT / PLAY / RESULT のすべてを
 *     単一の全画面 canvas に描いており、広告を置ける DOM 領域が存在しない。
 *     表示できる場所が無いページに Auto ads を読ませても、配信され得るのは
 *     アンカー広告だけになる
 *
 *  2. **そのアンカー広告がプレイ領域のタップを奪う。** AdSense のアンカー広告は
 *     z-index 2147483647（32bit 最大値）で body に後から挿入される。CSS の
 *     z-index を最大まで上げても「同値なら後から挿入された側が上」になるため、
 *     覆えない。実測でも画面下端のタップがすべて広告に吸われた。
 *     これは GDD §12-5 および第4幕の不合格条件2・3（広告干渉／RUNNING 中に
 *     ジャンプ以外の反応をする領域）に抵触する
 *
 *  3. **覆って誰にも見せない広告を配信し続けるのは、ポリシー上も望ましくない。**
 *     読み込まないことが、隠すことでも無効化することでもない唯一の正解である
 *
 * 本裁定は JumpOrDie のページに限る。kzkmr.net の他ページ・他アプリの Auto ads には
 * 一切影響しない（`layout.tsx` は本プロジェクト固有のファイルである）。
 */

const SITE_URL = "https://kzkmr.net/apps/jump-or-die";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "JumpOrDie｜とぶか、しぬか。1タップの死にゲー",
  description:
    "タップでジャンプ。操作はそれだけ。ゲームボーイ風のドットで描く、超高難度の自動横スクロールアクション。障害物の配置は完全固定、死因はいつも自分のタイミング。1プレイ数十秒、死んだら即リトライ。スマホでもPCでも無料で遊べます。",
  applicationName: "JumpOrDie",
  openGraph: {
    title: "JumpOrDie — とぶか、しぬか。",
    description: "1タップだけの、超高難度アクション。タイミングが すべて。",
    type: "website",
    url: SITE_URL,
    siteName: "JumpOrDie",
    locale: "ja_JP",
    images: [
      {
        url: "/ogp.png",
        width: 1280,
        height: 720,
        alt: "ゲームボーイ風ドットで描かれた JumpOrDie のタイトル画面",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JumpOrDie — とぶか、しぬか。",
    description: "1タップだけの、超高難度アクション。タイミングが すべて。",
    images: ["/ogp.png"],
  },
};

export const viewport: Viewport = {
  // 誤ったピンチズームでプレイ領域がずれるのを防ぐ（入力はタップ1種類のみ）
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // GB1 墨。アドレスバーまで含めてレターボックス色で塗る
  themeColor: "#081820",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      {/* 広告スクリプトは載せない。理由は冒頭のコメントを参照（社長裁定 2026-09-21） */}
      <body>{children}</body>
    </html>
  );
}
