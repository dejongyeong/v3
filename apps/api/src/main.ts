import { VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });

  // protect browser-facing responses
  app.useSecurityHeaders();

  // api versioning configuration: api/v1, api/v2, etc.
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>("PORT");

  await app.listen(port);
}
await bootstrap();
