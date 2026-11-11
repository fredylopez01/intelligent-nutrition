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
import { CategoriesService } from "./categories.service.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CreateCategoryDto } from "./dto/create-category.dto.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { ListCategoriesQueryDto } from "./dto/list-categories-query.dto.js";
import { UpdateCategoryStatusDto } from "./dto/update-category-status.dto.js";
import { UpdateCategoryDto } from "./dto/update-category.dto.js";

@ApiTags("Categories")
@ApiBearerAuth()
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles("DEV", "SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Create a category",
    description:
      "Registers a product category. Roles: DEV, SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 201, description: "Category created." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 409,
    description:
      "A category with this name already exists (CATEGORY_NAME_ALREADY_EXISTS).",
  })
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.categoriesService.create(
      createCategoryDto,
      currentUser,
      ipAddress,
    );
  }

  @Get()
  @Roles("DEV", "SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List categories",
    description:
      "Paginated list of categories. Roles: DEV, SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of categories." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid query parameters, or search shorter than 2 characters (SEARCH_TOO_SHORT).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListCategoriesQueryDto) {
    return this.categoriesService.findAll(query);
  }

  @Get(":categoryId")
  @Roles("DEV", "SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get a category",
    description:
      "Detail of a category. Roles: DEV, SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Category detail." })
  @ApiResponse({ status: 400, description: "categoryId is not a valid UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Category not found." })
  findOne(@Param("categoryId", new ParseUUIDPipe()) categoryId: string) {
    return this.categoriesService.findOne(categoryId);
  }

  @Patch(":categoryId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Update a category",
    description:
      "Updates the name and/or description. At least one field must be sent. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Category updated." })
  @ApiResponse({
    status: 400,
    description:
      "categoryId is not a valid UUID, invalid body, or no field provided.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Category not found." })
  @ApiResponse({
    status: 409,
    description: "A category with this name already exists.",
  })
  update(
    @Param("categoryId", new ParseUUIDPipe()) categoryId: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.categoriesService.update(
      categoryId,
      updateCategoryDto,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":categoryId/status")
  @Roles("SUPERADMIN")
  @ApiOperation({
    summary: "Activate or deactivate a category",
    description: "Changes the active status of a category. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "Category status updated." })
  @ApiResponse({
    status: 400,
    description: "categoryId is not a valid UUID, or invalid body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Category not found." })
  @ApiResponse({
    status: 409,
    description:
      "The category is already in the requested state (ALREADY_IN_STATE).",
  })
  updateStatus(
    @Param("categoryId", new ParseUUIDPipe()) categoryId: string,
    @Body() updateCategoryStatusDto: UpdateCategoryStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.categoriesService.updateStatus(
      categoryId,
      updateCategoryStatusDto.active,
      currentUser,
      ipAddress,
    );
  }
}
