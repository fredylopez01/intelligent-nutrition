import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module.js";
import { DashboardEmbedService } from "./dashboard-embed.service.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, DashboardEmbedService],
})
export class ReportsModule {}
