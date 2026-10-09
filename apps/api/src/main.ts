import { StandardSchemaValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // protect browser-facing responses
  app.useSecurityHeaders();
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  // api versioning configuration: api/v1, api/v2, etc.
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>("PORT");

  // listen on every network interface available to the process
  // this matters in containerized environments where the app needs to be accessible externally
  await app.listen(port, "0.0.0.0");
}
await bootstrap();
