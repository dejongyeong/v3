import { fileURLToPath } from "node:url";

import withBundleAnalyzer from "@next/bundle-analyzer";
import { SentryBuildOptions, withSentryConfig } from "@sentry/nextjs";
import { createJiti } from "jiti";
import type { NextConfig } from "next";

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
  },
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
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

export default withSentryConfig(bundleAnalyzer(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "dejongyeong",

  project: "v3-portfolio",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
