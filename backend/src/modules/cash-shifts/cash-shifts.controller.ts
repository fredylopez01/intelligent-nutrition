import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
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
import { CashShiftsService } from "./cash-shifts.service.js";
import { ActiveCashShiftQueryDto } from "./dto/active-cash-shift-query.dto.js";
import { CloseCashShiftDto } from "./dto/close-cash-shift.dto.js";
import { ListCashShiftsQueryDto } from "./dto/list-cash-shifts-query.dto.js";
import { OpenCashShiftDto } from "./dto/open-cash-shift.dto.js";

@ApiTags("Cash shifts")
@ApiBearerAuth()
@Controller("cash-shifts")
@UseGuards(BranchScopeGuard)
export class CashShiftsController {
  constructor(private readonly cashShiftsService: CashShiftsService) {}

  @Post()
  @HttpCode(201)
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Open a cash shift",
    description:
      "Opens a cash shift for the authenticated user in a branch. A user can only have one open shift and the branch must be active. Generates an audit log. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 201, description: "Shift opened." })
  @ApiResponse({
    status: 404,
    description: "Branch not found (BRANCH_NOT_FOUND).",
  })
  @ApiResponse({
    status: 422,
    description: "The branch is inactive (BRANCH_INACTIVE).",
  })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the branch is outside the user's assignments (BRANCH_SCOPE_VIOLATION).",
  })
  @ApiResponse({
    status: 409,
    description:
      "The user already has an open shift (SHIFT_ALREADY_OPEN), with its shiftId in details.",
  })
  open(
    @Body() dto: OpenCashShiftDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.cashShiftsService.open(dto, currentUser, ipAddress);
  }

  @Patch(":shiftId/close")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Close a cash shift",
    description:
      "Closes an open shift with its closing amount. Only the user who opened it or a SUPERADMIN can close it. Generates an audit log. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Shift closed." })
  @ApiResponse({ status: 400, description: "Invalid request body or id." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the shift belongs to another user (SHIFT_OWNER_REQUIRED).",
  })
  @ApiResponse({ status: 404, description: "Shift not found." })
  @ApiResponse({
    status: 409,
    description: "The shift is already closed (SHIFT_ALREADY_CLOSED).",
  })
  close(
    @Param("shiftId", new ParseUUIDPipe()) shiftId: string,
    @Body() dto: CloseCashShiftDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.cashShiftsService.close(shiftId, dto, currentUser, ipAddress);
  }

  @Get()
  @Roles("SUPERADMIN", "BRANCH_LEADER")
  @BranchScope("query.branchId")
  @ApiOperation({
    summary: "List cash shifts",
    description:
      "Paginated shifts ordered by openedAt desc, with filters by branch, state, dates and user. branchId is required for the branch leader. Roles: SUPERADMIN, BRANCH_LEADER.",
  })
  @ApiResponse({ status: 200, description: "Paginated list of shifts." })
  @ApiResponse({ status: 400, description: "Invalid query parameters." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the branch is outside the user's assignments (BRANCH_SCOPE_VIOLATION).",
  })
  findAll(
    @Query() query: ListCashShiftsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.cashShiftsService.findAll(query, currentUser);
  }

  @Get("active")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @BranchScope("query.branchId")
  @ApiOperation({
    summary: "Get the open cash shift of a branch",
    description:
      "Most recent open shift of the branch, or data: null. Used by the inventory closure to link the shift. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({
    status: 200,
    description: "Open shift of the branch, or null.",
  })
  @ApiResponse({ status: 400, description: "branchId missing or not a UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the branch is outside the user's assignments (BRANCH_SCOPE_VIOLATION).",
  })
  findActive(@Query() query: ActiveCashShiftQueryDto) {
    return this.cashShiftsService.findActive(query.branchId);
  }

  @Get(":shiftId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  @ApiOperation({
    summary: "Get a cash shift",
    description:
      "Detail of a shift with its observation. Roles: SUPERADMIN, BRANCH_LEADER, BRANCH_ASSISTANT.",
  })
  @ApiResponse({ status: 200, description: "Shift detail." })
  @ApiResponse({ status: 400, description: "The id is not a UUID." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({ status: 403, description: "Role not allowed." })
  @ApiResponse({ status: 404, description: "Shift not found." })
  findOne(@Param("shiftId", new ParseUUIDPipe()) shiftId: string) {
    return this.cashShiftsService.findOne(shiftId);
  }
}
