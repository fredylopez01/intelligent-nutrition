import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { BranchScopeGuard } from "../../common/guards/branch-scope.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { DashboardService } from "./dashboard.service.js";

@ApiTags("Dashboard")
@ApiBearerAuth()
@Controller("dashboard")
@UseGuards(BranchScopeGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("global")
  @Roles("SUPERADMIN")
  @ApiOperation({
    summary: "Get the global dashboard",
    description:
      "Same indicators as the branch dashboard for every active branch together, plus totalSalesToday, totalSalesCount, branchesActive, lowStockAlerts (products below the minimum in some branch) and topBranch (branch with the highest sales of the day, or null). Roles: SUPERADMIN.",
  })
  @ApiResponse({
    status: 200,
    description: "Indicators of every active branch.",
  })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  getGlobalDashboard() {
    return this.dashboardService.getGlobalDashboard();
  }

  @Get("branch/:branchId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get the dashboard of a branch",
    description:
      "Indicators of the branch calculated in real time with the Bogota business day: salesToday, salesYesterdayUntilNow (yesterday until the same hour), salesLast7Days, uniqueCustomersToday, monthlyRevenue, criticalStockProducts (products with less than 5 units), stock (units and top 3 categories), branches (open = with an open cash shift, and sales of the day), alerts (out of stock, last unit, below the minimum, expiring in 60 days; top 5) and topProducts (top 5 of the day by units). Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Indicators of the branch." })
  @ApiResponse({ status: 400, description: "The branchId is not a UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the branch is outside the user's assignments (BRANCH_SCOPE_VIOLATION).",
  })
  @ApiResponse({
    status: 404,
    description: "Branch not found (BRANCH_NOT_FOUND).",
  })
  getBranchDashboard(@Param("branchId", new ParseUUIDPipe()) branchId: string) {
    return this.dashboardService.getBranchDashboard(branchId);
  }
}
