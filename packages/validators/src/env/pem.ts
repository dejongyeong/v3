import { z } from "zod";

export function pemSchema(type: "PUBLIC KEY" | "PRIVATE KEY") {
  const header = `-----BEGIN ${type}-----`;
  const footer = `-----END ${type}-----`;

  return z
    .string()
    .transform(value => value.replaceAll("\\n", "\n").trim())
    .refine(
      value => value.startsWith(header) && value.endsWith(footer),
      `Expected a PEM-encoded ${type.toLowerCase()}`,
    );
}
