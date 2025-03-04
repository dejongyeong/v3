import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";
import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const jiti = createJiti(fileURLToPath(import.meta.url));

// validate env on build
jiti.esmResolve("./src/env.ts");

// bundle analyzer
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [],
    turbo: {
      rules: { ".svg": ["@svgr/webpack"] },
    },
  },
};

export default bundleAnalyzer(nextConfig);
