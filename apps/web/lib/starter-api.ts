import "server-only";
import { webEnvSchema } from "@repo/validators/env/web";
import { importPKCS8, SignJWT } from "jose";

export async function getStarterGreeting(): Promise<string> {
  const env = webEnvSchema.parse(process.env);
  const privateKey = await importPKCS8(
    env.NEST_API_SIGNING_PRIVATE_KEY,
    "EdDSA",
  );

  const token = await new SignJWT({ scope: "portfolio:read" })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .setIssuer("portfolio-web")
    .setAudience("portfolio-api")
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(privateKey);

  const url = new URL("/api/v1", env.NEST_API_BASE_URL);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok)
    throw new Error(`Failed to fetch starter greeting: ${response.statusText}`);

  return response.text();
}
