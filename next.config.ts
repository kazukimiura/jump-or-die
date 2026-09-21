import type { NextConfig } from "next";

// kzkmr.net の apps/ 配下に静的書き出しして配置する運用。
// basePath は製品名 JumpOrDie 確定済み（第1幕承認, 2026-09-21）。
const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/apps/jump-or-die',
  trailingSlash: true,
};

export default nextConfig;
