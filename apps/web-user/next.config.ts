import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Separate generated files for the localhost-only Auth QA harness.
  distDir: process.env.KANTIN_QA_ISOLATED === "1" ? ".next-qa-auth" : ".next",
  typescript: { tsconfigPath: process.env.KANTIN_QA_ISOLATED === "1" ? "tsconfig.qa.json" : "tsconfig.json" },
  transpilePackages: ["@kantin/ui"],
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
