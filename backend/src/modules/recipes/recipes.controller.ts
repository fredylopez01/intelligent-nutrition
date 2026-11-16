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
import { CreateRecipeDto } from "./dto/create-recipe.dto.js";
import { ListRecipesQueryDto } from "./dto/list-recipes-query.dto.js";
import { UpdateRecipeDto } from "./dto/update-recipe.dto.js";
import { UpdateRecipeStatusDto } from "./dto/update-recipe-status.dto.js";
import { RecipesService } from "./recipes.service.js";

@ApiTags("Recipes")
@ApiBearerAuth()
@Controller("recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List recipes",
    description:
      "Paginated list of recipes with the number of ingredients, search by name and filter by state. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of recipes." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid query parameters, or search shorter than 2 characters (VALIDATION_ERROR).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListRecipesQueryDto) {
    return this.recipesService.findAll(query);
  }

  @Get(":recipeId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get a recipe",
    description:
      "Detail of a recipe with its ingredients: supply, quantity and unit of measure. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Recipe with its ingredients." })
  @ApiResponse({ status: 400, description: "The id is not a UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Recipe not found (NOT_FOUND)." })
  findOne(@Param("recipeId", new ParseUUIDPipe()) recipeId: string) {
    return this.recipesService.findOne(recipeId);
  }

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Create a recipe",
    description:
      "Registers a recipe with at least one ingredient. Every ingredient is an active supply with a quantity greater than 0 and an active unit of measure. Generates an audit log. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({
    status: 201,
    description: "Recipe created with its ingredients.",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request body, or no ingredients.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description:
      "A supply or a unit of measure does not exist (SUPPLY_NOT_FOUND, UNIT_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description: "The name is already used (RECIPE_NAME_ALREADY_EXISTS).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Repeated supply (DUPLICATED_SUPPLY), inactive supply (SUPPLY_INACTIVE) or inactive unit (UNIT_INACTIVE).",
  })
  create(
    @Body() dto: CreateRecipeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.recipesService.create(dto, currentUser, ipAddress);
  }

  @Patch(":recipeId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Update a recipe",
    description:
      "Updates the name, the description or the ingredients. Sending ingredients replaces the whole list. Generates an audit log. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Recipe updated." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description: "Recipe, supply or unit not found.",
  })
  @ApiResponse({
    status: 409,
    description: "The name is already used (RECIPE_NAME_ALREADY_EXISTS).",
  })
  @ApiResponse({
    status: 422,
    description:
      "Repeated supply (DUPLICATED_SUPPLY), inactive supply (SUPPLY_INACTIVE) or inactive unit (UNIT_INACTIVE).",
  })
  update(
    @Param("recipeId", new ParseUUIDPipe()) recipeId: string,
    @Body() dto: UpdateRecipeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.recipesService.update(recipeId, dto, currentUser, ipAddress);
  }

  @Patch(":recipeId/status")
  @Roles("SUPERADMIN")
  @ApiOperation({
    summary: "Activate or deactivate a recipe",
    description:
      "Changes the state of a recipe. Generates an audit log. Roles: SUPERADMIN.",
  })
  @ApiResponse({ status: 200, description: "State changed." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Recipe not found (NOT_FOUND)." })
  @ApiResponse({
    status: 409,
    description: "The recipe is already in that state (ALREADY_IN_STATE).",
  })
  updateStatus(
    @Param("recipeId", new ParseUUIDPipe()) recipeId: string,
    @Body() dto: UpdateRecipeStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.recipesService.updateStatus(
      recipeId,
      dto.active,
      currentUser,
      ipAddress,
    );
  }
}
