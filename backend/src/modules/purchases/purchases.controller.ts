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
import { PurchasesService } from "./purchases.service.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { BranchScopeGuard } from "../../common/guards/branch-scope.guard.js";
import { CreatePurchaseDto } from "./dto/create-purchase.dto.js";
import { ListPurchasesQueryDto } from "./dto/list-purchases-query.dto.js";
import { ReceivePurchaseDto } from "./dto/receive-purchase.dto.js";

@ApiTags("Purchases")
@ApiBearerAuth()
@Controller("purchases")
@UseGuards(BranchScopeGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Register a purchase order",
    description:
      "Creates a purchase order for an active supplier. The stock enters only when the goods are received. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 201, description: "Purchase order created." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description:
      "Supplier or product not found (SUPPLIER_NOT_FOUND, PRODUCT_NOT_FOUND).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Business rule violated (DUPLICATED_PRODUCT, SUPPLIER_INACTIVE, PRODUCT_INACTIVE).",
  })
  create(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.purchasesService.create(
      createPurchaseDto,
      currentUser,
      ipAddress,
    );
  }

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "List purchase orders",
    description:
      "Paginated list of purchase orders. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of purchase orders.",
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid query parameters, or search shorter than 2 characters (SEARCH_TOO_SHORT).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListPurchasesQueryDto) {
    return this.purchasesService.findAll(query);
  }

  @Get(":purchaseId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Get a purchase order",
    description:
      "Detail of a purchase order. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Purchase order detail." })
  @ApiResponse({ status: 400, description: "purchaseId is not a valid UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description: "Purchase not found (PURCHASE_NOT_FOUND).",
  })
  findOne(@Param("purchaseId", new ParseUUIDPipe()) purchaseId: string) {
    return this.purchasesService.findOne(purchaseId);
  }

  @Post(":purchaseId/receipts")
  @HttpCode(200)
  @Roles("SUPERADMIN")
  @ApiOperation({
    summary: "Receive a purchase order",
    description:
      "Registers the lots received for one or more lines of a purchase order, with their expiration dates. Partial receipts are allowed. Roles: SUPERADMIN.",
  })
  @ApiResponse({
    status: 200,
    description:
      "Receipt registered; the purchase order is returned with its new status.",
  })
  @ApiResponse({
    status: 400,
    description: "purchaseId is not a valid UUID, or invalid request body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description:
      "Purchase, purchase line or branch not found (PURCHASE_NOT_FOUND, PURCHASE_DETAIL_NOT_FOUND, BRANCH_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description:
      "The purchase was already fully received (PURCHASE_ALREADY_RECEIVED).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Business rule violated (BRANCH_INACTIVE, DUPLICATED_PURCHASE_DETAIL, LOT_EXPIRED, RECEIVED_EXCEEDS_REQUESTED).",
  })
  receive(
    @Param("purchaseId", new ParseUUIDPipe()) purchaseId: string,
    @Body() receivePurchaseDto: ReceivePurchaseDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.purchasesService.receive(
      purchaseId,
      receivePurchaseDto,
      currentUser,
      ipAddress,
    );
  }
}
