import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { BranchScope } from "../../common/decorators/branch-scope.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { BranchScopeGuard } from "../../common/guards/branch-scope.guard.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { ListSalesReportQueryDto } from "./dto/list-sales-report-query.dto.js";
import { ReportsService } from "./reports.service.js";

@Controller("reports")
@UseGuards(BranchScopeGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("sales")
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @BranchScope("query.branchId")
  getSalesReport(
    @Query() query: ListSalesReportQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reportsService.getSalesReport(query, currentUser);
  }
}
