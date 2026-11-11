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
import { UnitMeasureService } from "./unit-measure.service.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CreateUnitMeasureDto } from "./dto/create-unit-measure.dto.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { ListUnitMeasureQueryDto } from "./dto/list-unit-measure-query.dto.js";
import { UpdateUnitMeasureDto } from "./dto/update-unit-measure.dto.js";
import { UpdateUnitMeasureStatusDto } from "./dto/update-unit-measure-status.dto.js";

@ApiTags("Units of measure")
@ApiBearerAuth()
@Controller("unit-measure")
export class UnitMeasureController {
  constructor(private readonly unitMeasureService: UnitMeasureService) {}

  @Post()
  @Roles("DEV", "SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Create a unit of measure",
    description:
      "Registers a unit of measure. Roles: DEV, SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 201, description: "Unit of measure created." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 409,
    description:
      "The name or the abbreviation already exists (UNIT_NAME_ALREADY_EXISTS, UNIT_ABBREVIATION_ALREADY_EXISTS).",
  })
  create(
    @Body() createUnitMeasureDto: CreateUnitMeasureDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.unitMeasureService.create(
      createUnitMeasureDto,
      currentUser,
      ipAddress,
    );
  }

  @Get()
  @Roles("DEV", "SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List units of measure",
    description:
      "Paginated list of units of measure. Roles: DEV, SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of units of measure.",
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid query parameters, or search shorter than 2 characters (SEARCH_TOO_SHORT).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListUnitMeasureQueryDto) {
    return this.unitMeasureService.findAll(query);
  }

  @Get(":unitMeasureId")
  @Roles("DEV", "SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get a unit of measure",
    description:
      "Detail of a unit of measure. Roles: DEV, SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Unit of measure detail." })
  @ApiResponse({
    status: 400,
    description: "unitMeasureId is not a valid UUID.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Unit of measure not found." })
  findOne(@Param("unitMeasureId", new ParseUUIDPipe()) unitMeasureId: string) {
    return this.unitMeasureService.findOne(unitMeasureId);
  }

  @Patch(":unitMeasureId")
  @Roles("SUPERADMIN")
  @ApiOperation({
    summary: "Update a unit of measure",
    description:
      "Updates the name and/or abbreviation. At least one field must be sent. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "Unit of measure updated." })
  @ApiResponse({
    status: 400,
    description:
      "unitMeasureId is not a valid UUID, invalid body, or no field provided.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Unit of measure not found." })
  @ApiResponse({
    status: 409,
    description: "The name or the abbreviation already exists.",
  })
  update(
    @Param("unitMeasureId", new ParseUUIDPipe()) unitMeasureId: string,
    @Body() updateUniteMeasureDto: UpdateUnitMeasureDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.unitMeasureService.update(
      unitMeasureId,
      updateUniteMeasureDto,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":unitMeasureId/status")
  @Roles("SUPERADMIN")
  @ApiOperation({
    summary: "Activate or deactivate a unit of measure",
    description:
      "Changes the active status of a unit of measure. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "Unit of measure status updated." })
  @ApiResponse({
    status: 400,
    description: "unitMeasureId is not a valid UUID, or invalid body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Unit of measure not found." })
  @ApiResponse({
    status: 409,
    description:
      "The unit is already in the requested state (ALREADY_IN_STATE).",
  })
  updateStatus(
    @Param("unitMeasureId", new ParseUUIDPipe()) unitMeasureId: string,
    @Body() UpdateUnitMeasureStatusDto: UpdateUnitMeasureStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.unitMeasureService.updateStatus(
      unitMeasureId,
      UpdateUnitMeasureStatusDto.active,
      currentUser,
      ipAddress,
    );
  }
}
