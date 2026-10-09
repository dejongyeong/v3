import { z } from "zod";
import { pemSchema } from "./pem.js";

export const webEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    NEST_API_BASE_URL: z.url({ protocol: /^https?$/ }),
    NEST_API_SIGNING_PRIVATE_KEY: pemSchema("PRIVATE KEY"),
  })
  .refine(
    ({ NODE_ENV, NEST_API_BASE_URL }) =>
      NODE_ENV !== "production" ||
      new URL(NEST_API_BASE_URL).protocol === "https:",
    {
      path: ["NEST_API_BASE_URL"],
      message: "Production API URL must use https",
    },
  );

export type WebEnv = z.output<typeof webEnvSchema>;
