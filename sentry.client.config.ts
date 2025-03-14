// this file configures the initialization of Sentry on the client.
// the config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs

import * as Sentry from "@sentry/nextjs";
import * as Spotlight from "@spotlightjs/spotlight";

import { env } from "@/env";

Sentry.init({
  // sentry dsn
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,

  // add optional integrations for additional features
  integrations: [
    // you can remove this option if not planning to use sentry session replay feature
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // define how likely traces are sampled.
  // adjust this value in production or use tracesSampler for a greater control
  tracesSampleRate: 1.0, // capture all traces

  // define how likely replay events are sampled
  // this sets the sample rate to be 10%.
  // you may want this to be 100% while in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // define how likely replay events are sampled when an error occurs
  replaysOnErrorSampleRate: 1.0,

  // settings this option to true will print useful information to the console while setting up sentry
  debug: false,
});

if (process.env.NODE_ENV === "development") {
  // enable spotlight for development
  Spotlight.init();
}
