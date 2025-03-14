// sentry.edge.config.(js/ts)
import * as Sentry from "@sentry/nextjs";

import { env } from "@/env";

Sentry.init({
  // sentry dsn
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,

  // replay may only be enabled for the client side
  integrations: [],

  // define how likely traces are sampled.
  // adjust this value in production or use tracesSampler for a greater control
  tracesSampleRate: 1.0,

  // setting this option to true will print useful information to the console while setting up sentry
  debug: false,

  // enable spotlight for development
  spotlight: process.env.NODE_ENV === "development",
});
