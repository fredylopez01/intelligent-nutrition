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
import { ProductsService } from "./products.service.js";
import { CreateProductDto } from "./dto/create-product.dto.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { ListProductsQueryDto } from "./dto/list-products-query.dto.js";
import { UpdateProductDto } from "./dto/update-product.dto.js";
import { UpdateProductStatusDto } from "./dto/update-product-status.dto.js";

@ApiTags("Products")
@ApiBearerAuth()
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Create a product",
    description:
      "Registers a product with an active category and an active unit of measure. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 201, description: "Product created." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description:
      "Category or unit of measure not found (CATEGORY_NOT_FOUND, UNIT_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description:
      "The reference code is already used (PRODUCT_REFERENCE_CODE_ALREADY_EXISTS).",
  })
  @ApiResponse({
    status: 422,
    description:
      "The category or the unit of measure is inactive (CATEGORY_INACTIVE, UNIT_INACTIVE).",
  })
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.productsService.create(
      createProductDto,
      currentUser,
      ipAddress,
    );
  }

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "List products",
    description:
      "Paginated list of products. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of products." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid query parameters, or search shorter than 2 characters (SEARCH_TOO_SHORT).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(":productId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get a product",
    description:
      "Detail of a product. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Product detail." })
  @ApiResponse({ status: 400, description: "productId is not a valid UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description: "Product not found (PRODUCT_NOT_FOUND).",
  })
  findOne(@Param("productId", new ParseUUIDPipe()) productId: string) {
    return this.productsService.findOne(productId);
  }

  @Patch(":productId")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Update a product",
    description:
      "Updates the name, description, category, unit of measure and/or price. The reference code cannot be changed. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Product updated." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid productId or body, referenceCode sent (FIELD_NOT_EDITABLE), or no editable field provided (NO_FIELDS_TO_UPDATE).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description:
      "Product, category or unit of measure not found (PRODUCT_NOT_FOUND, CATEGORY_NOT_FOUND, UNIT_NOT_FOUND).",
  })
  @ApiResponse({
    status: 422,
    description:
      "The category or the unit of measure is inactive (CATEGORY_INACTIVE, UNIT_INACTIVE).",
  })
  update(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.productsService.update(
      productId,
      updateProductDto,
      currentUser,
      ipAddress,
    );
  }

  @Patch(":productId/status")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @ApiOperation({
    summary: "Activate or deactivate a product",
    description:
      "Changes the active status of a product. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Product status updated." })
  @ApiResponse({
    status: 400,
    description: "productId is not a valid UUID, or invalid body.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description: "Product not found (PRODUCT_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description:
      "The product is already in the requested state (ALREADY_IN_STATE).",
  })
  updateStatus(
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() updateProductStatusDto: UpdateProductStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.productsService.updateStatus(
      productId,
      updateProductStatusDto.active,
      currentUser,
      ipAddress,
    );
  }
}
