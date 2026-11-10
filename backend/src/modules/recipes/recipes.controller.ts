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
import { CreateRecipeDto } from "./dto/create-recipe.dto.js";
import { ListRecipesQueryDto } from "./dto/list-recipes-query.dto.js";
import { UpdateRecipeDto } from "./dto/update-recipe.dto.js";
import { UpdateRecipeStatusDto } from "./dto/update-recipe-status.dto.js";
import { RecipesService } from "./recipes.service.js";

@Controller("recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  findAll(@Query() query: ListRecipesQueryDto) {
    return this.recipesService.findAll(query);
  }

  @Get(":recipeId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  findOne(@Param("recipeId", new ParseUUIDPipe()) recipeId: string) {
    return this.recipesService.findOne(recipeId);
  }

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  create(
    @Body() dto: CreateRecipeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.recipesService.create(dto, currentUser, ipAddress);
  }

  @Patch(":recipeId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
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
