import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { BranchScope } from "../../common/decorators/branch-scope.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { BranchScopeGuard } from "../../common/guards/branch-scope.guard.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CreateSupplyStockMovementDto } from "./dto/create-supply-stock-movement.dto.js";
import { UpdateSupplyMinimumDto } from "./dto/update-supply-minimum.dto.js";
import { ConvertProductToSupplyDto } from "./dto/convert-product-to-supply.dto.js";
import { ListSupplyStockQueryDto } from "./dto/list-supply-stock-query.dto.js";
import { SupplyStockService } from "./supply-stock.service.js";

@ApiTags("Supply stock")
@ApiBearerAuth()
@Controller("supply-stock")
@UseGuards(BranchScopeGuard)
export class SupplyStockController {
  constructor(private readonly supplyStockService: SupplyStockService) {}

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @BranchScope("query.branchId")
  @ApiOperation({
    summary: "List the supply stock",
    description:
      "Paginated stock of every active supply in every active branch, 0 when the branch has never received it. lowStock is quantity < minimumQuantity. branchId is required for branch roles. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Paginated stock rows." })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the branch is outside the user's assignments (BRANCH_SCOPE_VIOLATION).",
  })
  findAll(
    @Query() query: ListSupplyStockQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.supplyStockService.findAll(query, currentUser);
  }

  @Post("movement")
  @HttpCode(201)
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Register a supply movement",
    description:
      "Adds (ENTRY) or removes (EXIT) whole units of a supply in a branch and records the movement. EXIT requires an observation and cannot exceed the stock. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({
    status: 201,
    description: "Movement registered with the resulting quantity.",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid body, or EXIT without observation.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the branch is outside the user's assignments (BRANCH_SCOPE_VIOLATION).",
  })
  @ApiResponse({
    status: 404,
    description:
      "Supply or branch not found (SUPPLY_NOT_FOUND, BRANCH_NOT_FOUND).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Not enough stock (INSUFFICIENT_SUPPLY_STOCK), inactive supply (SUPPLY_INACTIVE) or inactive branch (BRANCH_INACTIVE).",
  })
  createMovement(
    @Body() dto: CreateSupplyStockMovementDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.supplyStockService.createMovement(dto, currentUser);
  }

  @Post("conversions")
  @HttpCode(201)
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Convert catalog product units into a supply",
    description:
      "Opens whole units of the product linked to the supply (for example a 2 lb whey): takes them from the branch inventory, earliest expiration first and without touching units held by web orders, records EXIT movements, and adds productUnits × productUnitQuantity to the supply stock with an ENTRY movement. Recipes then consume the supply. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 201, description: "Conversion registered." })
  @ApiResponse({ status: 400, description: "Invalid body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "BRANCH_SCOPE_VIOLATION." })
  @ApiResponse({ status: 404, description: "Supply or branch not found." })
  @ApiResponse({
    status: 422,
    description:
      "The supply has no product (SUPPLY_NOT_LINKED), not enough units (INSUFFICIENT_STOCK) or inactive product, supply or branch.",
  })
  convertProduct(
    @Body() dto: ConvertProductToSupplyDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.supplyStockService.convertProduct(dto, currentUser, ipAddress);
  }

  @Patch("minimum")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @BranchScope("body.branchId")
  @ApiOperation({
    summary: "Set the minimum stock of a supply in a branch",
    description:
      "Saves the minimum quantity used to flag the low stock of the supply in the branch. Generates an audit log. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Stock row updated." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the branch is outside the user's assignments (BRANCH_SCOPE_VIOLATION).",
  })
  @ApiResponse({
    status: 404,
    description:
      "Supply or branch not found (SUPPLY_NOT_FOUND, BRANCH_NOT_FOUND).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Inactive supply (SUPPLY_INACTIVE) or inactive branch (BRANCH_INACTIVE).",
  })
  updateMinimum(
    @Body() dto: UpdateSupplyMinimumDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.supplyStockService.updateMinimum(dto, currentUser, ipAddress);
  }
}
