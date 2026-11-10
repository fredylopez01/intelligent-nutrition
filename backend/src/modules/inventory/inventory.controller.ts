import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { InventoryService } from "./inventory.service.js";
import { AssignProductDto } from "./dto/assign-product.dto.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { ListBranchInventoryQueryDto } from "./dto/list-branch-inventory-query.dto.js";
import { UpdateMinimumStockDto } from "./dto/update-minimunstock.dto.js";

@ApiTags("Inventory")
@ApiBearerAuth()
@Controller("branches/:branchId/inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Assign a product to a branch",
    description:
      "Adds a lot of a product to the inventory of a branch. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 201, description: "Product assigned to the branch." })
  @ApiResponse({
    status: 400,
    description: "branchId is not a valid UUID, or invalid request body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or branch outside the user's scope (BRANCH_OUT_OF_SCOPE).",
  })
  @ApiResponse({
    status: 404,
    description:
      "Branch or product not found (BRANCH_NOT_FOUND, PRODUCT_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description:
      "The product already has a lot in this branch with the same expiration date (PRODUCT_ALREADY_ASSIGNED).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Business rule violated (BRANCH_INACTIVE, PRODUCT_INACTIVE, LOT_EXPIRED).",
  })
  assignProduct(
    @Param("branchId", new ParseUUIDPipe()) branchId: string,
    @Body() assignProductDto: AssignProductDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.inventoryService.assignProductToBranch(
      branchId,
      assignProductDto,
      currentUser,
      ipAddress,
    );
  }

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List the inventory of a branch",
    description:
      "Paginated inventory of a branch, with the total quantity and low-stock flag per product. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated inventory of the branch.",
  })
  @ApiResponse({
    status: 400,
    description:
      "branchId is not a valid UUID, invalid query parameters, or search shorter than 2 characters (SEARCH_TOO_SHORT).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or branch outside the user's scope (BRANCH_OUT_OF_SCOPE).",
  })
  @ApiResponse({
    status: 404,
    description: "Branch not found (BRANCH_NOT_FOUND).",
  })
  findAll(
    @Param("branchId", new ParseUUIDPipe()) branchId: string,
    @Query() query: ListBranchInventoryQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.inventoryService.findAllByBranch(branchId, query, currentUser);
  }

  @Get(":productId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get a product of a branch inventory",
    description:
      "Inventory detail of a product in a branch, with its lots. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({
    status: 200,
    description: "Inventory detail of the product in the branch.",
  })
  @ApiResponse({
    status: 400,
    description: "branchId or productId is not a valid UUID.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or branch outside the user's scope (BRANCH_OUT_OF_SCOPE).",
  })
  @ApiResponse({
    status: 404,
    description:
      "The product is not assigned to the branch (PRODUCT_NOT_ASSIGNED).",
  })
  findOne(
    @Param("branchId", new ParseUUIDPipe()) branchId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.inventoryService.findOneByBranchAndProduct(
      branchId,
      productId,
      currentUser,
    );
  }

  @Patch(":productId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Update the minimum stock of a product",
    description:
      "Changes the minimum stock threshold of a product in a branch. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Minimum stock updated." })
  @ApiResponse({
    status: 400,
    description:
      "branchId or productId is not a valid UUID, or invalid request body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or branch outside the user's scope (BRANCH_OUT_OF_SCOPE).",
  })
  @ApiResponse({
    status: 404,
    description:
      "Branch not found or product not assigned to it (BRANCH_NOT_FOUND, PRODUCT_NOT_ASSIGNED).",
  })
  @ApiResponse({
    status: 422,
    description: "The branch is inactive (BRANCH_INACTIVE).",
  })
  updateMinimumStock(
    @Param("branchId", new ParseUUIDPipe()) branchId: string,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() updateMinimumStockDto: UpdateMinimumStockDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.inventoryService.updateMinimumStock(
      branchId,
      productId,
      updateMinimumStockDto,
      currentUser,
      ipAddress,
    );
  }
}
