import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CashShiftStatus } from "../../../generated/prisma/enums.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { OpenCashShiftDto } from "./dto/open-cash-shift.dto.js";
import { CloseCashShiftDto } from "./dto/close-cash-shift.dto.js";
import { ListCashShiftsQueryDto } from "./dto/list-cash-shifts-query.dto.js";
import { businessDayBounds } from "../../common/utils/business-day.util.js";

const SHIFT_SELECT = {
  id: true,
  branch: { select: { id: true, name: true } },
  user: {
    select: {
      personId: true,
      person: { select: { firstName: true, lastName: true } },
    },
  },
  status: true,
  openedAt: true,
  closedAt: true,
  openingAmount: true,
  closingAmount: true,
  observation: true,
} as const;

function toShiftResponse(shift: {
  id: string;
  branch: { id: string; name: string };
  user: { personId: string; person: { firstName: string | null; lastName: string | null } };
  status: CashShiftStatus;
  openedAt: Date;
  closedAt: Date | null;
  openingAmount: { toString(): string };
  closingAmount: { toString(): string } | null;
  observation: string | null;
}) {
  const names = [shift.user.person.firstName, shift.user.person.lastName].filter(Boolean);
  return {
    id: shift.id,
    branch: shift.branch,
    user: { id: shift.user.personId, fullName: names.join(" ") || null },
    status: shift.status,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    openingAmount: shift.openingAmount.toString(),
    closingAmount: shift.closingAmount?.toString() ?? null,
    observation: shift.observation,
  };
}

@Injectable()
export class CashShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async open(
    dto: OpenCashShiftDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const { branchId, openingAmount, observation } = dto;

    const existing = await this.prisma.cashShift.findFirst({
      where: { userId: currentUser.id, status: CashShiftStatus.OPEN },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: "SHIFT_ALREADY_OPEN",
        message: "You already have an open cash shift.",
        details: { shiftId: existing.id },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.cashShift.create({
        data: {
          branchId,
          userId: currentUser.id,
          openingAmount,
          observation: observation ?? null,
        },
        select: SHIFT_SELECT,
      });

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: "CREATE",
          entity: "CASH_SHIFT",
          entityId: shift.id,
          newData: { branchId, openingAmount },
          reason: "Apertura de turno de caja",
          ipAddress,
        },
        tx,
      );

      return { data: toShiftResponse(shift) };
    });
  }

  async close(
    shiftId: string,
    dto: CloseCashShiftDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const shift = await this.prisma.cashShift.findUnique({
      where: { id: shiftId },
      select: { id: true, userId: true, status: true, branchId: true, openingAmount: true },
    });
    if (!shift) {
      throw new NotFoundException("Cash shift not found.");
    }
    if (shift.status === CashShiftStatus.CLOSED) {
      throw new ConflictException({
        code: "SHIFT_ALREADY_CLOSED",
        message: "This cash shift is already closed.",
      });
    }
    if (
      shift.userId !== currentUser.id &&
      currentUser.role.name !== "SUPERADMIN"
    ) {
      throw new ForbiddenException({
        code: "SHIFT_OWNER_REQUIRED",
        message: "Only the shift owner or a SUPERADMIN can close this shift.",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cashShift.update({
        where: { id: shiftId },
        data: {
          status: CashShiftStatus.CLOSED,
          closedAt: new Date(),
          closingAmount: dto.closingAmount,
          observation: dto.observation ?? null,
        },
        select: SHIFT_SELECT,
      });

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: "UPDATE",
          entity: "CASH_SHIFT",
          entityId: shiftId,
          oldData: { status: CashShiftStatus.OPEN },
          newData: { status: CashShiftStatus.CLOSED, closingAmount: dto.closingAmount },
          reason: "Cierre de turno de caja",
          ipAddress,
        },
        tx,
      );

      return { data: toShiftResponse(updated) };
    });
  }

  async findAll(
    query: ListCashShiftsQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    const { branchId, status, from, to, userId, page, limit } = query;

    if (currentUser.role.name === "BRANCH_LEADER") {
      if (!branchId) {
        throw new ForbiddenException({
          code: "BRANCH_SCOPE_VIOLATION",
          message: "branchId is required for your role.",
        });
      }
      const assignedIds = new Set(
        (currentUser.branches ?? []).map((b) => b.id),
      );
      if (!assignedIds.has(branchId)) {
        throw new ForbiddenException({
          code: "BRANCH_SCOPE_VIOLATION",
          message: "You do not have access to this branch.",
        });
      }
    }

    const where: Record<string, unknown> = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (from || to) {
      where.openedAt = {};
      if (from) (where.openedAt as Record<string, unknown>).gte = businessDayBounds(from).start;
      if (to) (where.openedAt as Record<string, unknown>).lte = businessDayBounds(to).end;
    }

    const skip = (page - 1) * limit;

    const [total, shifts] = await this.prisma.$transaction([
      this.prisma.cashShift.count({ where }),
      this.prisma.cashShift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: "desc" },
        select: {
          id: true,
          branch: { select: { id: true, name: true } },
          user: {
            select: {
              personId: true,
              person: { select: { firstName: true, lastName: true } },
            },
          },
          status: true,
          openedAt: true,
          closedAt: true,
          openingAmount: true,
          closingAmount: true,
        },
      }),
    ]);

    return {
      data: shifts.map((s) => {
        const names = [s.user.person.firstName, s.user.person.lastName].filter(Boolean);
        return {
          id: s.id,
          branch: s.branch,
          user: { id: s.user.personId, fullName: names.join(" ") || null },
          status: s.status,
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          openingAmount: s.openingAmount.toString(),
          closingAmount: s.closingAmount?.toString() ?? null,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(shiftId: string) {
    const shift = await this.prisma.cashShift.findUnique({
      where: { id: shiftId },
      select: SHIFT_SELECT,
    });
    if (!shift) {
      throw new NotFoundException("Cash shift not found.");
    }
    return { data: toShiftResponse(shift) };
  }
}
