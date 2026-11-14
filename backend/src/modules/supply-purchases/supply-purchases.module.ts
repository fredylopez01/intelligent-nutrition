import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { SupplyPurchasesController } from "./supply-purchases.controller.js";
import { SupplyPurchasesService } from "./supply-purchases.service.js";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SupplyPurchasesController],
  providers: [SupplyPurchasesService],
})
export class SupplyPurchasesModule {}
