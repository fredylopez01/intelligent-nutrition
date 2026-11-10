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
import { BranchScope } from "../../common/decorators/branch-scope.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { BranchScopeGuard } from "../../common/guards/branch-scope.guard.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CashShiftsService } from "./cash-shifts.service.js";
import { CloseCashShiftDto } from "./dto/close-cash-shift.dto.js";
import { ListCashShiftsQueryDto } from "./dto/list-cash-shifts-query.dto.js";
import { OpenCashShiftDto } from "./dto/open-cash-shift.dto.js";

@Controller("cash-shifts")
@UseGuards(BranchScopeGuard)
export class CashShiftsController {
  constructor(private readonly cashShiftsService: CashShiftsService) {}

  @Post()
  @HttpCode(201)
  @Roles("BRANCH_LEADER", "BRANCH_ASSISTANT")
  open(
    @Body() dto: OpenCashShiftDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.cashShiftsService.open(dto, currentUser, ipAddress);
  }

  @Patch(":shiftId/close")
  @Roles("BRANCH_LEADER", "BRANCH_ASSISTANT")
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
  findAll(
    @Query() query: ListCashShiftsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.cashShiftsService.findAll(query, currentUser);
  }

  @Get(":shiftId")
  @Roles("SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT")
  findOne(@Param("shiftId", new ParseUUIDPipe()) shiftId: string) {
    return this.cashShiftsService.findOne(shiftId);
  }
}
