import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { z } from "zod";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: z.object({
        PORT: z.coerce.number().int().min(1).max(65535).default(3001),
        NODE_ENV: z
          .enum(["development", "production", "test"])
          .default("development"),
        NEST_API_SIGNING_PRIVATE_KEY: z
          .string()
          .length(
            64,
            "NEST_API_SIGNING_PRIVATE_KEY must be 64 characters long",
          ),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
