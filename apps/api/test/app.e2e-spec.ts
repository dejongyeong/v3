import type { INestApplication } from "@nestjs/common";
import { StandardSchemaValidationPipe, VersioningType } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import request from "supertest";
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, describe, it } from "vitest";

describe("AppController (e2e)", () => {
  let app: INestApplication<App> | undefined;
  let serviceToken = "";

  const previousEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    publicKey: process.env.NEST_API_SIGNING_PUBLIC_KEY,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.PORT = "3001";

    const { privateKey, publicKey } = await generateKeyPair("EdDSA");
    process.env.NEST_API_SIGNING_PUBLIC_KEY = await exportSPKI(publicKey);

    // Import after setting the test key because AppModule configures the guard
    // with its public key when the Nest module graph is initialized.
    const { AppModule } = await import("../src/app.module.js");
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useSecurityHeaders();
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();

    serviceToken = await new SignJWT({ scope: "portfolio:read" })
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
      .setIssuer("portfolio-web")
      .setAudience("portfolio-api")
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(privateKey);
  });

  afterAll(async () => {
    await app?.close();

    if (previousEnvironment.nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousEnvironment.nodeEnv;
    }

    if (previousEnvironment.port === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousEnvironment.port;
    }

    if (previousEnvironment.publicKey === undefined) {
      delete process.env.NEST_API_SIGNING_PUBLIC_KEY;
    } else {
      process.env.NEST_API_SIGNING_PUBLIC_KEY = previousEnvironment.publicKey;
    }
  });

  it("rejects a request without a service token", async () => {
    if (!app) throw new Error("Nest application was not initialized");

    await request(app.getHttpServer()).get("/api/v1").expect(401);
  });

  it("returns the starter response for a valid signed service token", async () => {
    if (!app) throw new Error("Nest application was not initialized");

    await request(app.getHttpServer())
      .get("/api/v1")
      .set("Authorization", `Bearer ${serviceToken}`)
      .expect(200)
      .expect("Hello World!");
  });
});
