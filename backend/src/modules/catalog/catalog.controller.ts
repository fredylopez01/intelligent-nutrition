import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator.js";
import { CatalogService } from "./catalog.service.js";
import { ListCatalogProductsQueryDto } from "./dto/list-catalog-products-query.dto.js";

@ApiTags("Catalog")
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("products")
  @Public()
  @ApiOperation({
    summary: "List the public catalog",
    description:
      "Active products of active categories with available units (quantity > 0 and not expired) in an active branch or in the general warehouse stock. Each item has the price, the primary image, branchUnits, availableInWarehouse and the units per branch. It never exposes costs or warehouse quantities. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Paginated public catalog." })
  @ApiResponse({
    status: 400,
    description: "Invalid query or search shorter than 2 characters.",
  })
  listProducts(@Query() query: ListCatalogProductsQueryDto) {
    return this.catalogService.listProducts(query);
  }

  @Get("categories")
  @Public()
  @ApiOperation({
    summary: "List the catalog categories",
    description:
      "Active categories with the number of available catalog products. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Categories with productCount." })
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Get("products/:productId")
  @Public()
  @ApiOperation({
    summary: "Get a catalog product",
    description:
      "Detail of an available catalog product with its description, every image and the units per branch. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Catalog product." })
  @ApiResponse({ status: 400, description: "productId is not a UUID." })
  @ApiResponse({
    status: 404,
    description:
      "The product does not exist, is inactive or has no available units (PRODUCT_NOT_FOUND).",
  })
  getProduct(@Param("productId", new ParseUUIDPipe()) productId: string) {
    return this.catalogService.getProduct(productId);
  }
}
