import { z } from "zod";
import { pemSchema } from "./pem.js";

export const webEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEST_API_BASE_URL: z.url({ protocol: /^https?$/ }),
  NEST_API_SIGNING_PRIVATE_KEY: pemSchema("PRIVATE KEY"),
});

export type WebEnv = z.output<typeof webEnvSchema>;
