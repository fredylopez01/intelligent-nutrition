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
import { CreateSupplyDto } from "./dto/create-supply.dto.js";
import { ListSuppliesQueryDto } from "./dto/list-supplies-query.dto.js";
import { UpdateSupplyDto } from "./dto/update-supply.dto.js";
import { UpdateSupplyStatusDto } from "./dto/update-supply-status.dto.js";
import { SuppliesService } from "./supplies.service.js";

@ApiTags("Supplies")
@ApiBearerAuth()
@Controller("supplies")
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Create a supply",
    description:
      "Registers an active supply and assigns it to every active branch with stock 0. Generates an audit log. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 201, description: "Supply created." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Unit of measure not found." })
  @ApiResponse({
    status: 409,
    description: "The name is already used (SUPPLY_NAME_ALREADY_EXISTS).",
  })
  @ApiResponse({
    status: 422,
    description: "The unit of measure is inactive (UNIT_INACTIVE).",
  })
  create(
    @Body() dto: CreateSupplyDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.suppliesService.create(dto, currentUser, ipAddress);
  }

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List supplies",
    description:
      "Paginated catalog of supplies, with search by name and filter by state. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of supplies." })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListSuppliesQueryDto) {
    return this.suppliesService.findAll(query);
  }

  @Get(":supplyId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get a supply",
    description:
      "Detail of a supply. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Supply detail." })
  @ApiResponse({ status: 400, description: "The id is not a UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Supply not found." })
  findOne(@Param("supplyId", new ParseUUIDPipe()) supplyId: string) {
    return this.suppliesService.findOne(supplyId);
  }

  @Patch(":supplyId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Update a supply",
    description:
      "Updates the name or the unit of measure. At least one field. Generates an audit log. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Supply updated." })
  @ApiResponse({ status: 400, description: "Invalid body or no field sent." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description: "Supply or unit of measure not found.",
  })
  @ApiResponse({
    status: 409,
    description: "The name is already used (SUPPLY_NAME_ALREADY_EXISTS).",
  })
  @ApiResponse({
    status: 422,
    description: "The unit of measure is inactive (UNIT_INACTIVE).",
  })
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
  @ApiOperation({
    summary: "Activate or deactivate a supply",
    description:
      "Changes the state of a supply. Generates an audit log. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "State changed." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Supply not found." })
  @ApiResponse({
    status: 409,
    description: "The supply is already in that state (ALREADY_IN_STATE).",
  })
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
