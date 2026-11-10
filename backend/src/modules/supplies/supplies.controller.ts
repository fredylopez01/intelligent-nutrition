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
import { CreateSupplyDto } from "./dto/create-supply.dto.js";
import { ListSuppliesQueryDto } from "./dto/list-supplies-query.dto.js";
import { UpdateSupplyDto } from "./dto/update-supply.dto.js";
import { UpdateSupplyStatusDto } from "./dto/update-supply-status.dto.js";
import { SuppliesService } from "./supplies.service.js";

@Controller("supplies")
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  create(
    @Body() dto: CreateSupplyDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.suppliesService.create(dto, currentUser, ipAddress);
  }

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  findAll(@Query() query: ListSuppliesQueryDto) {
    return this.suppliesService.findAll(query);
  }

  @Get(":supplyId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  findOne(@Param("supplyId", new ParseUUIDPipe()) supplyId: string) {
    return this.suppliesService.findOne(supplyId);
  }

  @Patch(":supplyId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  update(
    @Param("supplyId", new ParseUUIDPipe()) supplyId: string,
    @Body() dto: UpdateSupplyDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.suppliesService.update(supplyId, dto, currentUser, ipAddress);
  }

  @Patch(":supplyId/status")
  @Roles("SUPERADMIN")
  updateStatus(
    @Param("supplyId", new ParseUUIDPipe()) supplyId: string,
    @Body() dto: UpdateSupplyStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.suppliesService.updateStatus(
      supplyId,
      dto.active,
      currentUser,
      ipAddress,
    );
  }
}
