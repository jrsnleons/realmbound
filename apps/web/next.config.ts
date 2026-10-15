import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  transpilePackages: ['@realmbound/content', '@realmbound/game-engine', '@realmbound/pixel', '@realmbound/server'],
};

export default config;
