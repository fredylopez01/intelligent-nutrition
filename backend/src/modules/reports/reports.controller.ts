import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { BranchScope } from "../../common/decorators/branch-scope.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { BranchScopeGuard } from "../../common/guards/branch-scope.guard.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { ListSalesReportQueryDto } from "./dto/list-sales-report-query.dto.js";
import { RestockReportQueryDto } from "./dto/restock-report-query.dto.js";
import { ReportsService } from "./reports.service.js";

@ApiTags("Reports")
@ApiBearerAuth()
@Controller("reports")
@UseGuards(BranchScopeGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("sales")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @BranchScope("query.branchId")
  @ApiOperation({
    summary: "Get the sales report",
    description:
      "Completed sales grouped by day and branch for a date range (Bogota business days), paginated. The superadmin can omit branchId to see every branch; the branch leader must send one of its branches. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated rows with day, branch, salesCount and totalAmount.",
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid query parameters, or from after to (INVALID_DATE_RANGE).",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the branch is outside the user's assignments (BRANCH_SCOPE_VIOLATION).",
  })
  getSalesReport(
    @Query() query: ListSalesReportQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reportsService.getSalesReport(query, currentUser);
  }

  @Get("restock")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @BranchScope("query.branchId")
  @ApiOperation({
    summary: "Get the restock suggestion",
    description:
      "Products below their minimum stock, with projectedDemand7d (completed sales of the last 30 days x 7 / 30, rounded up) and suggestedUnits (the greater of the minimum stock and the projected demand, minus the current quantity). Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Products to restock." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the branch is outside the user's assignments (BRANCH_SCOPE_VIOLATION).",
  })
  getRestockReport(
    @Query() query: RestockReportQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reportsService.getRestockReport(query, currentUser);
  }
}
