import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { SuppliesController } from "./supplies.controller.js";
import { SuppliesService } from "./supplies.service.js";
import { SupplyStockController } from "./supply-stock.controller.js";
import { SupplyStockService } from "./supply-stock.service.js";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SuppliesController, SupplyStockController],
  providers: [SuppliesService, SupplyStockService],
})
export class SuppliesModule {}
