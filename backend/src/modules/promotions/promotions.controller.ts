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
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CreatePromotionDto } from "./dto/create-promotion.dto.js";
import { ListPromotionsQueryDto } from "./dto/list-promotions-query.dto.js";
import { UpdatePromotionDto } from "./dto/update-promotion.dto.js";
import { UpdatePromotionStatusDto } from "./dto/update-promotion-status.dto.js";
import { PromotionsService } from "./promotions.service.js";

@Controller("promotions")
@Roles("SUPERADMIN")
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
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
  findAll(@Query() query: ListPromotionsQueryDto) {
    return this.promotionsService.findAll(query);
  }

  @Get("active")
  @Roles("DEV", "SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  findActive() {
    return this.promotionsService.findActive();
  }

  @Get(":promotionId")
  findOne(@Param("promotionId", new ParseUUIDPipe()) promotionId: string) {
    return this.promotionsService.findOne(promotionId);
  }

  @Patch(":promotionId")
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
