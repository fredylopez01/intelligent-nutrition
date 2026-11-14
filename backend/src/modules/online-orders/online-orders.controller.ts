import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CompleteOnlineOrderDto } from "./dto/complete-online-order.dto.js";
import { CreateOnlineOrderDto } from "./dto/create-online-order.dto.js";
import { ListOnlineOrdersQueryDto } from "./dto/list-online-orders-query.dto.js";
import { OrderAvailabilityDto } from "./dto/online-order-item.dto.js";
import { UpdateOnlineOrderStatusDto } from "./dto/update-online-order-status.dto.js";
import { OnlineOrdersService } from "./online-orders.service.js";

const STAFF = ["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const;

@ApiTags("Online orders")
@Controller("orders")
export class OnlineOrdersController {
  constructor(private readonly ordersService: OnlineOrdersService) {}

  @Post("availability")
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: "Check a cart against every branch",
    description:
      "Returns the current price of each product and, per active branch, the units available (stock not expired minus the units held by other web orders), whether the whole cart is available and whether the branch does home deliveries. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Availability per branch." })
  @ApiResponse({ status: 400, description: "Invalid cart." })
  @ApiResponse({
    status: 404,
    description: "A product does not exist (PRODUCT_NOT_FOUND).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Repeated product (DUPLICATED_PRODUCT) or product no longer sold (PRODUCT_INACTIVE).",
  })
  availability(@Body() dto: OrderAvailabilityDto) {
    return this.ordersService.availability(dto.items);
  }

  @Get("document-types")
  @Public()
  @ApiOperation({
    summary: "List the document types for the customer registration",
    description: "Active document types. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Document types." })
  documentTypes() {
    return this.ordersService.documentTypes();
  }

  @Post()
  @Public()
  @ApiOperation({
    summary: "Place a web order",
    description:
      "Creates a PENDING order with a code (P-YYYYMMDD-0001) and holds its units for 48 hours. PICKUP uses the chosen branch; DELIVERY (Tunja) picks the delivery branch that has the whole cart. With register = true the buyer is registered or linked as a customer by document. Payment and delivery fee are agreed on WhatsApp. Notifies the superadmins and the staff of the branch. Public endpoint.",
  })
  @ApiResponse({ status: 201, description: "Order created." })
  @ApiResponse({ status: 400, description: "Invalid body." })
  @ApiResponse({
    status: 404,
    description:
      "Branch or product not found (BRANCH_NOT_FOUND, PRODUCT_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description: "The email belongs to another person (EMAIL_ALREADY_IN_USE).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Not enough units (INSUFFICIENT_STOCK), no delivery branch (DELIVERY_UNAVAILABLE), inactive branch or product, or repeated product.",
  })
  create(@Body() dto: CreateOnlineOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  @Roles(...STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List the web orders",
    description:
      "Newest first, filtered by status, fulfillment, branch and search (code, name or phone). meta.openOrders counts the orders still in progress. Branch roles only see their branches. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Paginated web orders." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed or branch outside the assignments (BRANCH_SCOPE_VIOLATION).",
  })
  findAll(
    @Query() query: ListOnlineOrdersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.findAll(query, user);
  }

  @Get(":id")
  @Roles(...STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get a web order",
    description: "Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Web order." })
  @ApiResponse({
    status: 404,
    description: "Order not found (ORDER_NOT_FOUND).",
  })
  findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.findOne(id, user);
  }

  @Patch(":id/status")
  @Roles(...STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Move a web order to another status",
    description:
      "PENDING → CONFIRMED | CANCELLED; CONFIRMED → READY (pickup) | OUT_FOR_DELIVERY (delivery) | CANCELLED; READY and OUT_FOR_DELIVERY → CANCELLED. Cancelling needs a reason and releases the units. Generates an audit log. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Order updated." })
  @ApiResponse({
    status: 400,
    description: "Invalid status or missing reason.",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found (ORDER_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description:
      "Transition not allowed (INVALID_STATUS_TRANSITION) or hold expired (ORDER_EXPIRED).",
  })
  updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOnlineOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.ordersService.updateStatus(id, dto, user, ipAddress);
  }

  @Post(":id/complete")
  @Roles(...STAFF)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary: "Confirm the purchase of a web order",
    description:
      "Registers the sale of the order in its branch (FEFO lots, current prices, one payment for the whole total) and marks the order DELIVERED. Works from PENDING (not expired), CONFIRMED, READY or OUT_FOR_DELIVERY. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Order delivered with its sale." })
  @ApiResponse({
    status: 404,
    description: "Order not found (ORDER_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description:
      "The order is not open (INVALID_STATUS_TRANSITION, ORDER_EXPIRED).",
  })
  @ApiResponse({
    status: 422,
    description:
      "The sale cannot be registered: INSUFFICIENT_STOCK, INVENTORY_CLOSED, PAYMENT_METHOD_INACTIVE, etc.",
  })
  complete(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteOnlineOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.ordersService.complete(id, dto, user, ipAddress);
  }
}
