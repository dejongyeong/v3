import { Controller, Get, Inject } from "@nestjs/common";
import { AppService } from "./app.service.js";

@Controller({ version: "1" })
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
