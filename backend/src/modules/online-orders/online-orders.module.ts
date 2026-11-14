import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { PersonsModule } from "../persons/persons.module.js";
import { SalesModule } from "../sales/sales.module.js";
import { OnlineOrdersController } from "./online-orders.controller.js";
import { OnlineOrdersService } from "./online-orders.service.js";

@Module({
  imports: [PrismaModule, AuditModule, PersonsModule, SalesModule],
  controllers: [OnlineOrdersController],
  providers: [OnlineOrdersService],
})
export class OnlineOrdersModule {}
