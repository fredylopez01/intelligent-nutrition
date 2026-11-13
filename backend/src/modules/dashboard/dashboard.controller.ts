import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { BranchScopeGuard } from "../../common/guards/branch-scope.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
@UseGuards(BranchScopeGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("global")
  @Roles("SUPERADMIN")
  getGlobalDashboard() {
    return this.dashboardService.getGlobalDashboard();
  }

  @Get("branch/:branchId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  getBranchDashboard(@Param("branchId", new ParseUUIDPipe()) branchId: string) {
    return this.dashboardService.getBranchDashboard(branchId);
  }
}
