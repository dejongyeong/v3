import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // DATABASE_URL: z.string().url(), // not using in this project
    LOGTAIL_SOURCE_TOKEN: z.string().optional(),
    ARCJET_KEY: z.string().startsWith("ajkey_").optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },

  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  },

  // need to destructure all keys manually
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    // DATABASE_URL: process.env.DATABASE_URL,
    LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN,
    ARCJET_KEY: process.env.ARCJET_KEY,
  },
});
