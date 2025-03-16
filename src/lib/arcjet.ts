import arcjet, {
  ArcjetNext,
  detectBot,
  shield,
  slidingWindow,
} from "@arcjet/next";

import { env } from "@/env";

export { createMiddleware } from "@arcjet/next";

const aj: ArcjetNext<Record<string, unknown>> = arcjet({
  key: env.ARCJET_KEY!,

  // track requests by user ip address
  characteristics: ["ip.src"],

  rules: [
    // protects against common attacks, e.g., sql injection, xss, etc.
    shield({
      mode: "LIVE", // will block requests, use "DRY_RUN" to log only
    }),
    // protects against automated clients and bots
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:MONITOR",
        "CATEGORY:PREVIEW",
        "CATEGORY:OPTIMIZER",
        "CATEGORY:SEARCH_ENGINE",
      ],
    }),
    // rate limit requests
    slidingWindow({
      mode: "LIVE",
      interval: 60, // 60 second sliding window
      max: 100,
    }),
  ],
});

export default aj;
