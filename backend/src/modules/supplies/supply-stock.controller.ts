import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BranchScope } from "../../common/decorators/branch-scope.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { BranchScopeGuard } from "../../common/guards/branch-scope.guard.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CreateSupplyStockMovementDto } from "./dto/create-supply-stock-movement.dto.js";
import { ListSupplyStockQueryDto } from "./dto/list-supply-stock-query.dto.js";
import { SupplyStockService } from "./supply-stock.service.js";

@Controller("supply-stock")
@UseGuards(BranchScopeGuard)
export class SupplyStockController {
  constructor(private readonly supplyStockService: SupplyStockService) {}

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @BranchScope("query.branchId")
  findAll(
    @Query() query: ListSupplyStockQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.supplyStockService.findAll(query, currentUser);
  }

  @Post("movement")
  @HttpCode(201)
  @Roles("BRANCH_LEADER", "BRANCH_ASSISTANT")
  createMovement(
    @Body() dto: CreateSupplyStockMovementDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.supplyStockService.createMovement(dto, currentUser, ipAddress);
  }
}
