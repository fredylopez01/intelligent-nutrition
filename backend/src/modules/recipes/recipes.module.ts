import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma/prisma.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { RecipesController } from "./recipes.controller.js";
import { RecipesService } from "./recipes.service.js";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
