import { Controller, Get } from "@nestjs/common";
import type { AppService } from "./app.service.js";

@Controller({ version: "1" })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
