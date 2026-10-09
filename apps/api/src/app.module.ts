import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { apiEnvSchema } from "@repo/validators/env/api";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { ServiceTokenGuard } from "./auth/service-token.guard.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: apiEnvSchema,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ServiceTokenGuard }],
})
export class AppModule {}
