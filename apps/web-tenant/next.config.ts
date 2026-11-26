import type { NextConfig } from 'next';

const config: NextConfig = {
  devIndicators: false,
  transpilePackages: ['@kantin/ui', '@kantin/staff'],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};

export default config;
