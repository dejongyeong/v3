import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";
import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { SentryBuildOptions, withSentryConfig } from "@sentry/nextjs";

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

const sentryBuildOptions: SentryBuildOptions = {
  // org and project are required
  org: "dejongyeong",
  project: "v3-portfolio",

  // only print logs for uploading source maps in ci
  silent: !process.env.CI,

  // automatically tree-shake sentry logger statements to reduce bundle size
  disableLogger: true,

  // enables automatic instrumentation of vercel cron monitors
  automaticVercelMonitors: true,

  // add readable stack traces with source maps
  // upload a larger set of source maps for prettier stack traces (increases build time)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,

  // avoid ad blockers with tunneling
  // route browser requests to sentry through next.js rewrite to circumvent ad blockers
  // this can increase server load as well as hosting bill
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-side errors will fail.
  tunnelRoute: "/monitoring",

  // automatically annotate react components to show their source code in sentry issues
  reactComponentAnnotation: { enabled: true },

  // disable sentry telemetry
  telemetry: false,
};

export default withSentryConfig(bundleAnalyzer(nextConfig), sentryBuildOptions);
