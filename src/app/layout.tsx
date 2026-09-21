import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

/**
 * ルートレイアウト。
 *
 * メタデータは UIテキスト §8 の確定文をそのまま使う（画面外なので文字数制約の対象外）。
 * Web フォントは読み込まない。画面の文字はすべて描画層のドットフォント（画像スプライト）で
 * 描くため、フォント読み込みの遅延・FOUT は構造的に発生しない（GDD §12-4）。
 */

// AdSense のパブリッシャーID（Auto ads / kzkmr.net 全体方針）
const ADSENSE_CLIENT = "ca-pub-5387424308621149";

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
      <body>
        {children}
        {/*
          Auto ads は kzkmr.net 全体方針として載せるが、**プレイを阻害させない**。
          - 読み込みは `lazyOnload`。ゲームの起動とハイドレーションに割り込ませない
            （憲法4: 入力遅延は仕様である）
          - ゲームは `.jd-root` の `position: fixed; inset: 0` 全画面レイヤーで描画され、
            アンカー広告が挿入されてもプレイ領域のレイアウトとタップ判定に触れられない
            （GDD §12-5 / 第4幕の不合格条件）
        */}
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
