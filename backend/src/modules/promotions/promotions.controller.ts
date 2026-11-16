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
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CreatePromotionDto } from "./dto/create-promotion.dto.js";
import { ListPromotionsQueryDto } from "./dto/list-promotions-query.dto.js";
import { UpdatePromotionDto } from "./dto/update-promotion.dto.js";
import { UpdatePromotionStatusDto } from "./dto/update-promotion-status.dto.js";
import { PromotionsService } from "./promotions.service.js";

@ApiTags("Promotions")
@ApiBearerAuth()
@Controller("promotions")
@Roles("SUPERADMIN")
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @ApiOperation({
    summary: "Create a promotion",
    description:
      "Registers an inactive promotion with its discount percentage and optional validity dates. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 201, description: "Promotion created, inactive." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid request body, or endDate before startDate (VALIDATION_ERROR).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 409,
    description:
      "The name is already used (PROMOTION_NAME_ALREADY_EXISTS), or the dates overlap another promotion (PROMOTION_DATE_RANGE_OVERLAP).",
  })
  create(
    @Body() createPromotionDto: CreatePromotionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.promotionsService.create(
      createPromotionDto,
      currentUser,
      ipAddress,
    );
  }

  @Get()
  @ApiOperation({
    summary: "List promotions",
    description:
      "Paginated list of promotions, with search by name and filter by state. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of promotions." })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListPromotionsQueryDto) {
    return this.promotionsService.findAll(query);
  }

  @Get("active")
  @Roles("DEV", "SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get the active promotion",
    description:
      "Active promotion that applies today, or data: null. Roles: DEV, SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({
    status: 200,
    description: "Active promotion, or null when there is none.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findActive() {
    return this.promotionsService.findActive();
  }

  @Get("applicable")
  @Roles("DEV", "SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List the promotions valid today",
    description:
      "Promotions whose validity dates include today, active or not, to choose one at the point of sale. The active one comes first. Roles: DEV, SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Promotions valid today." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findApplicable() {
    return this.promotionsService.findApplicable();
  }

  @Get(":promotionId")
  @ApiOperation({
    summary: "Get a promotion",
    description: "Detail of a promotion. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "Promotion detail." })
  @ApiResponse({ status: 400, description: "The id is not a UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Promotion not found (NOT_FOUND)." })
  findOne(@Param("promotionId", new ParseUUIDPipe()) promotionId: string) {
    return this.promotionsService.findOne(promotionId);
  }

  @Patch(":promotionId")
  @ApiOperation({
    summary: "Update a promotion",
    description:
      "Updates the name, the percentage or the dates of an inactive promotion. At least one field. Generates an audit log. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "Promotion updated." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid body, no field sent, or endDate before startDate (VALIDATION_ERROR).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Promotion not found (NOT_FOUND)." })
  @ApiResponse({
    status: 409,
    description:
      "Repeated name (PROMOTION_NAME_ALREADY_EXISTS) or overlapping dates (PROMOTION_DATE_RANGE_OVERLAP).",
  })
  @ApiResponse({
    status: 422,
    description:
      "The promotion is active and cannot be edited (PROMOTION_IS_ACTIVE).",
  })
  update(
    @Param("promotionId", new ParseUUIDPipe()) promotionId: string,
    @Body() updatePromotionDto: UpdatePromotionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.promotionsService.update(
      promotionId,
      updatePromotionDto,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":promotionId/status")
  @ApiOperation({
    summary: "Activate or deactivate a promotion",
    description:
      "Activating a promotion deactivates the previous active one in the same transaction. Generates an audit log. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "State changed." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Promotion not found (NOT_FOUND)." })
  @ApiResponse({
    status: 409,
    description: "The promotion is already in that state (ALREADY_IN_STATE).",
  })
  updateStatus(
    @Param("promotionId", new ParseUUIDPipe()) promotionId: string,
    @Body() updatePromotionStatusDto: UpdatePromotionStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.promotionsService.updateStatus(
      promotionId,
      updatePromotionStatusDto.active,
      currentUser,
      ipAddress,
    );
  }
}
