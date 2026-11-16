import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { InventoryService } from "./inventory.service.js";
import { AvailabilityQueryDto } from "./dto/availability-query.dto.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { ListConsolidatedQueryDto } from "./dto/list-consolidated-query.dto.js";

@ApiTags("Inventory")
@ApiBearerAuth()
@Controller("inventory")
export class InventoryGlobalController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("availability")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get the availability of a product across branches",
    description:
      "Units of a product available in each active branch, counting only lots that have not expired. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({
    status: 200,
    description: "Availability of the product per branch.",
  })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({
    status: 404,
    description: "Product not found (PRODUCT_NOT_FOUND).",
  })
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.inventoryService.getAvailability(
      query.productId,
      query.excludeBranchId,
    );
  }

  @Get("consolidated")
  @Roles("SUPERADMIN")
  @ApiOperation({
    summary: "Get the consolidated inventory",
    description:
      "Paginated stock of every product consolidated across all branches. Roles: SUPERADMIN.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated consolidated inventory.",
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid query parameters, or search shorter than 2 characters (SEARCH_TOO_SHORT).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  getConsolidated(@Query() query: ListConsolidatedQueryDto) {
    return this.inventoryService.getConsolidated(query);
  }
}
