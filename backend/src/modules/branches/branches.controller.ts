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
import { CreateBranchDto } from "./dto/create-branch.dto.js";
import { ListBranchesQueryDto } from "./dto/list-branches-query.dto.js";
import { ListSellableProductsQueryDto } from "./dto/list-sellable-products-query.dto.js";
import { UpdateBranchDto } from "./dto/update-branch.dto.js";
import { UpdateBranchStatusDto } from "./dto/update-branch-status.dto.js";
import { BranchesService } from "./branches.service.js";
import { Public } from "../../common/decorators/public.decorator.js";

@ApiTags("Branches")
@Controller("branches")
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: "List branches",
    description: "Paginated list of branches. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of branches." })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  findAll(@Query() query: ListBranchesQueryDto) {
    return this.branchesService.findAll(query);
  }

  @Get(":id")
  @Public()
  @ApiOperation({
    summary: "Get a branch",
    description: "Detail of a branch. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Branch detail." })
  @ApiResponse({ status: 400, description: "id is not a valid UUID." })
  @ApiResponse({ status: 404, description: "Branch not found." })
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.branchesService.findOne(id);
  }

  @Post()
  @Roles("SUPERADMIN")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create a branch",
    description: "Registers a new branch. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 201, description: "Branch created." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 409,
    description: "A branch with this name already exists.",
  })
  create(
    @Body() createBranchDto: CreateBranchDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.branchesService.create(createBranchDto, currentUser, ipAddress);
  }

  @Patch(":id")
  @Roles("SUPERADMIN", "DEV")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update a branch",
    description:
      "Updates the name, address and/or phone of a branch. At least one field must be sent. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({ status: 200, description: "Branch updated." })
  @ApiResponse({
    status: 400,
    description: "id is not a valid UUID, invalid body, or no field provided.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Branch not found." })
  @ApiResponse({
    status: 409,
    description: "A branch with this name already exists.",
  })
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.branchesService.update(
      id,
      updateBranchDto,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":id/status")
  @Roles("SUPERADMIN", "DEV")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Activate or deactivate a branch",
    description:
      "Changes the active status of a branch. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({ status: 200, description: "Branch status updated." })
  @ApiResponse({
    status: 400,
    description:
      "id is not a valid UUID, invalid body, or the branch is already in the requested state.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Branch not found." })
  updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() updateBranchStatusDto: UpdateBranchStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.branchesService.updateStatus(
      id,
      updateBranchStatusDto.active,
      currentUser,
      ipAddress,
    );
  }

  @Get(":id/sellable-products")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List the sellable products of a branch",
    description:
      "Paginated list of active products with non-expired stock in the branch. Branch-scoped roles can only query their assigned branches. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of sellable products.",
  })
  @ApiResponse({
    status: 400,
    description: "id is not a valid UUID, or invalid query parameters.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or branch outside the user's scope (BRANCH_SCOPE_VIOLATION).",
  })
  @ApiResponse({
    status: 404,
    description: "Branch not found (BRANCH_NOT_FOUND).",
  })
  findSellableProducts(
    @Param("id", new ParseUUIDPipe()) branchId: string,
    @Query() query: ListSellableProductsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.branchesService.findSellableProducts(
      branchId,
      query,
      currentUser,
    );
  }
}
