import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/next";

import { env } from "@/env";

// create base arcjet instance
// ArcjetNext<Record<string, unknown>>
export default arcjet({
  // get site key from project, store in env variable
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
    tokenBucket({
      mode: "LIVE",
      capacity: 1000, // bucket maximum capacity
      refillRate: 5, // refill 5 tokens per interval
      interval: 10, // 10 seconds interval
    }),
  ],
});
