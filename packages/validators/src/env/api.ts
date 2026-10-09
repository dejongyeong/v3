import { z } from "zod";
import { pemSchema } from "./pem.js";

export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NEST_API_SIGNING_PUBLIC_KEY: pemSchema("PUBLIC KEY"),
});

export type ApiEnv = z.output<typeof apiEnvSchema>;
