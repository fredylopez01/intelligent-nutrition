import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
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
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { BranchScopeGuard } from "../../common/guards/branch-scope.guard.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CreateSaleDto } from "./dto/create-sale.dto.js";
import { ListSalesQueryDto } from "./dto/list-sales-query.dto.js";
import { SalesService } from "./sales.service.js";
import { ReverseSaleDto } from "./dto/reverse-sale.dto.js";

@ApiTags("Sales")
@ApiBearerAuth()
@Controller("sales")
@UseGuards(BranchScopeGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List sales",
    description:
      "Paginated list of sales. Branch-scoped roles must send branchId for one of their branches. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of sales." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid query parameters, or branchId missing for a branch-scoped role (BRANCH_REQUIRED).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or branch outside the user's scope (BRANCH_SCOPE_VIOLATION).",
  })
  findAll(
    @Query() query: ListSalesQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.salesService.findAll(query, currentUser);
  }

  @Get(":saleId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get a sale",
    description:
      "Detail of a single sale. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Sale detail." })
  @ApiResponse({ status: 400, description: "saleId is not a valid UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the sale belongs to a branch outside the user's scope (BRANCH_SCOPE_VIOLATION).",
  })
  @ApiResponse({ status: 404, description: "Sale not found (SALE_NOT_FOUND)." })
  findOne(
    @Param("saleId", new ParseUUIDPipe()) saleId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.salesService.findOne(saleId, currentUser);
  }

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Register a sale",
    description:
      "Registers a sale for a branch: consumes stock from the branch inventory, records the exit movements and stores the payments. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 201, description: "Sale registered." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or branch outside the user's scope (BRANCH_SCOPE_VIOLATION).",
  })
  @ApiResponse({
    status: 404,
    description:
      "Branch, customer, product or payment method not found (BRANCH_NOT_FOUND, CUSTOMER_NOT_FOUND, PRODUCT_NOT_FOUND, PAYMENT_METHOD_NOT_FOUND).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Business rule violated (DUPLICATED_PRODUCT, BRANCH_INACTIVE, INVENTORY_CLOSED, CUSTOMER_INACTIVE, PRODUCT_INACTIVE, PAYMENT_METHOD_INACTIVE, DISCOUNT_EXCEEDS_SUBTOTAL, PAYMENT_AMOUNT_INVALID, PAYMENT_TOTAL_MISMATCH, INSUFFICIENT_STOCK).",
  })
  create(
    @Body() createSaleDto: CreateSaleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.salesService.create(createSaleDto, currentUser);
  }

  @Post(":saleId/reverse")
  @HttpCode(200)
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Reverse a sale",
    description:
      "Reverses a completed sale: restores the sold units to the inventory and records the entry movements. Not allowed once the inventory closure of the sale's day is confirmed. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Sale reversed." })
  @ApiResponse({
    status: 400,
    description:
      "saleId is not a valid UUID, or reason is shorter than 10 characters.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the sale belongs to a branch outside the user's scope (BRANCH_SCOPE_VIOLATION).",
  })
  @ApiResponse({ status: 404, description: "Sale not found (SALE_NOT_FOUND)." })
  @ApiResponse({
    status: 409,
    description:
      "The sale cannot be reversed (SALE_ALREADY_REVERSED, SALE_NOT_REVERSIBLE).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Business rule violated (SALE_DAY_CLOSED, SALE_REVERSAL_NO_INVENTORY).",
  })
  reverse(
    @Param("saleId", new ParseUUIDPipe()) saleId: string,
    @Body() reverseSaleDto: ReverseSaleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.salesService.reverse(
      saleId,
      reverseSaleDto,
      currentUser,
      ipAddress,
    );
  }
}
