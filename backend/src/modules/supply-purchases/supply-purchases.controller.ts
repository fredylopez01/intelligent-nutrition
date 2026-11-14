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
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CreateSupplyPurchaseDto } from "./dto/create-supply-purchase.dto.js";
import { ListSupplyPurchasesQueryDto } from "./dto/list-supply-purchases-query.dto.js";
import { ReceiveSupplyPurchaseDto } from "./dto/receive-supply-purchase.dto.js";
import { SupplyPurchasesService } from "./supply-purchases.service.js";

@ApiTags("Supply purchases")
@ApiBearerAuth()
@Controller("supply-purchases")
export class SupplyPurchasesController {
  constructor(private readonly service: SupplyPurchasesService) {}

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Register a purchase of supplies",
    description:
      "Purchase of supplies (milk, bulk protein...) to an active supplier, with quantity in the unit of each supply (up to 3 decimals) and unit cost. Starts as PENDING_RECEIPT. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 201, description: "Purchase created." })
  @ApiResponse({ status: 400, description: "Invalid body." })
  @ApiResponse({ status: 404, description: "Supplier or supply not found." })
  @ApiResponse({
    status: 422,
    description:
      "Inactive supplier or supply, or repeated supply (DUPLICATED_SUPPLY).",
  })
  create(
    @Body() dto: CreateSupplyPurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.service.create(dto, user, ipAddress);
  }

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "List the purchases of supplies",
    description: "Newest first. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Paginated purchases." })
  findAll(@Query() query: ListSupplyPurchasesQueryDto) {
    return this.service.findAll(query);
  }

  @Get(":id")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Get a purchase of supplies",
    description: "Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Purchase with its lines." })
  @ApiResponse({ status: 404, description: "SUPPLY_PURCHASE_NOT_FOUND." })
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Post(":id/receipts")
  @HttpCode(200)
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Receive supplies of a purchase in a branch",
    description:
      "Adds the received quantities to the supply stock of the branch, records an ENTRY movement per supply and updates the status (PARTIALLY_RECEIVED or FULLY_RECEIVED). A branch leader can only receive in an assigned branch. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Purchase after the receipt." })
  @ApiResponse({ status: 403, description: "BRANCH_SCOPE_VIOLATION." })
  @ApiResponse({
    status: 404,
    description: "Purchase, line or branch not found.",
  })
  @ApiResponse({ status: 409, description: "PURCHASE_ALREADY_RECEIVED." })
  @ApiResponse({
    status: 422,
    description:
      "QUANTITY_EXCEEDS_PENDING, BRANCH_INACTIVE or DUPLICATED_LINE.",
  })
  receive(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: ReceiveSupplyPurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.service.receive(id, dto, user, ipAddress);
  }
}
