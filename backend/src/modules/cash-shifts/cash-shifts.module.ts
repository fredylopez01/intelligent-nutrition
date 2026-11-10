import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { CashShiftsController } from "./cash-shifts.controller.js";
import { CashShiftsService } from "./cash-shifts.service.js";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CashShiftsController],
  providers: [CashShiftsService],
})
export class CashShiftsModule {}
