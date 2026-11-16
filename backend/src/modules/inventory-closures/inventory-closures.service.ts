import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { ConfirmClosureDto } from "./dto/confirm-closure.dto.js";
import { UpdateCountsDto } from "./dto/update-counts.dto.js";
import { ListClosuresQueryDto } from "./dto/list-closures-query.dto.js";
import { businessDate } from "../../common/utils/business-day.util.js";
import {
  formatExpirationDate,
  toExpirationDate,
} from "../../common/utils/expiration.util.js";

const CLOSURE_SELECT = {
  id: true,
  branchId: true,
  cashShiftId: true,
  closureDate: true,
  status: true,
  confirmed: true,
  locked: true,
  closedAt: true,
  branch: { select: { name: true } },
  user: {
    select: { person: { select: { firstName: true, lastName: true } } },
  },
  details: {
    select: {
      id: true,
      productId: true,
      expirationDate: true,
      systemQuantity: true,
      physicalQuantity: true,
      difference: true,
      observation: true,
      product: {
        select: {
          name: true,
          referenceCode: true,
          unitOfMeasure: { select: { abreviation: true } },
        },
      },
    },
  },
  supplyDetails: {
    select: {
      id: true,
      supplyId: true,
      systemQuantity: true,
      physicalQuantity: true,
      difference: true,
      observation: true,
      supply: {
        select: {
          name: true,
          unitOfMeasure: { select: { abreviation: true } },
        },
      },
    },
  },
} satisfies Prisma.InventoryClosureSelect;

type ClosureRow = Prisma.InventoryClosureGetPayload<{
  select: typeof CLOSURE_SELECT;
}>;

type UserName = {
  person: { firstName: string | null; lastName: string | null };
} | null;

function fullName(user: UserName): string | null {
  if (!user) return null;
  return (
    [user.person.firstName, user.person.lastName].filter(Boolean).join(" ") ||
    null
  );
}

function lotKey(productId: string, expirationDate: Date | null): string {
  return `${productId}|${expirationDate ? formatExpirationDate(expirationDate) : ""}`;
}

function canSeeDifferences(currentUser: AuthenticatedUser): boolean {
  const roleName = currentUser.role?.name;
  return roleName === "SUPERADMIN" || roleName === "BRANCH_LEADER";
}

function isScopedRole(currentUser: AuthenticatedUser): boolean {
  const roleName = currentUser.role?.name;
  return roleName === "BRANCH_LEADER" || roleName === "BRANCH_ASSISTANT";
}

function hasSupplyDifference(detail: {
  difference: Prisma.Decimal | null;
}): boolean {
  return detail.difference !== null && !detail.difference.isZero();
}

function decimalText(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toString();
}

function toSupplyItems(closure: ClosureRow, reveal: boolean) {
  return [...closure.supplyDetails]
    .sort((a, b) => a.supply.name.localeCompare(b.supply.name, "es"))
    .map((detail) => ({
      supplyId: detail.supplyId,
      supplyName: detail.supply.name,
      unit: detail.supply.unitOfMeasure.abreviation,
      systemQuantity: detail.systemQuantity.toString(),
      physicalQuantity: decimalText(detail.physicalQuantity),
      observation: detail.observation,
      ...(reveal ? { difference: decimalText(detail.difference) } : {}),
    }));
}

function toClosureResponse(
  closure: ClosureRow,
  currentUser: AuthenticatedUser,
) {
  const reveal = closure.status !== "PENDING" && canSeeDifferences(currentUser);
  const supplyItems = toSupplyItems(closure, reveal);
  const items = [...closure.details]
    .sort(
      (a, b) =>
        a.product.name.localeCompare(b.product.name, "es") ||
        (a.expirationDate?.getTime() ?? 0) - (b.expirationDate?.getTime() ?? 0),
    )
    .map((detail) => ({
      productId: detail.productId,
      productName: detail.product.name,
      referenceCode: detail.product.referenceCode,
      unit: detail.product.unitOfMeasure.abreviation,
      expirationDate: detail.expirationDate
        ? formatExpirationDate(detail.expirationDate)
        : null,
      systemQuantity: detail.systemQuantity,
      physicalQuantity: detail.physicalQuantity,
      observation: detail.observation,
      ...(reveal ? { difference: detail.difference } : {}),
    }));

  return {
    id: closure.id,
    branchId: closure.branchId,
    cashShiftId: closure.cashShiftId,
    branchName: closure.branch.name,
    closureDate: formatExpirationDate(closure.closureDate),
    status: closure.status,
    confirmed: closure.confirmed,
    locked: closure.locked,
    closedAt: closure.closedAt,
    userName: fullName(closure.user),
    countedItems: items.filter((item) => item.physicalQuantity !== null).length,
    totalItems: items.length,
    ...(reveal
      ? {
          totalDifferences: closure.details.filter(
            (detail) => detail.difference !== null && detail.difference !== 0,
          ).length,
          totalSupplyDifferences:
            closure.supplyDetails.filter(hasSupplyDifference).length,
        }
      : {}),
    items,
    countedSupplies: supplyItems.filter(
      (item) => item.physicalQuantity !== null,
    ).length,
    totalSupplies: supplyItems.length,
    supplyItems,
  };
}

@Injectable()
export class InventoryClosuresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(branchId: string, currentUser: AuthenticatedUser) {
    this.assertBranchScope(branchId, currentUser);

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { id: true, active: true },
      });
      if (!branch) {
        throw new NotFoundException({
          code: "BRANCH_NOT_FOUND",
          message: "Branch not found.",
        });
      }
      if (!branch.active) {
        throw new UnprocessableEntityException({
          code: "BRANCH_INACTIVE",
          message: "Branch is inactive.",
        });
      }

      const closureDate = businessDate();
      const existing = await tx.inventoryClosure.findUnique({
        where: { branchId_closureDate: { branchId, closureDate } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: "CLOSURE_ALREADY_EXISTS",
          message: "An inventory closure already exists for this branch today.",
          details: { closureId: existing.id },
        });
      }

      const lots = await tx.branchInventory.findMany({
        where: { branchId, quantity: { gt: 0 }, product: { active: true } },
        select: { productId: true, expirationDate: true, quantity: true },
      });

      const supplies = await tx.supply.findMany({
        where: { active: true },
        select: {
          id: true,
          stocks: { where: { branchId }, select: { quantity: true } },
        },
      });

      const closure = await tx.inventoryClosure.create({
        data: {
          branchId,
          userId: currentUser.id,
          closureDate,
          status: "PENDING",
          confirmed: false,
          locked: false,
          details: {
            create: lots.map((lot) => ({
              productId: lot.productId,
              expirationDate: lot.expirationDate,
              systemQuantity: lot.quantity,
            })),
          },
          supplyDetails: {
            create: supplies.map((supply) => ({
              supplyId: supply.id,
              systemQuantity:
                supply.stocks[0]?.quantity ?? new Prisma.Decimal(0),
            })),
          },
        },
        select: CLOSURE_SELECT,
      });

      return toClosureResponse(closure, currentUser);
    });
  }

  async findOne(closureId: string, currentUser: AuthenticatedUser) {
    const closure = await this.prisma.inventoryClosure.findUnique({
      where: { id: closureId },
      select: CLOSURE_SELECT,
    });
    if (!closure) throw this.notFound();
    this.assertBranchScope(closure.branchId, currentUser);
    return toClosureResponse(closure, currentUser);
  }

  async updateCounts(
    closureId: string,
    dto: UpdateCountsDto,
    currentUser: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const closure = await tx.inventoryClosure.findUnique({
        where: { id: closureId },
        select: CLOSURE_SELECT,
      });
      if (!closure) throw this.notFound();
      this.assertBranchScope(closure.branchId, currentUser);
      this.assertPending(closure);

      const items = dto.items ?? [];
      const supplyItems = dto.supplyItems ?? [];
      if (items.length === 0 && supplyItems.length === 0) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Send at least one product or supply count.",
        });
      }

      const keys = items.map((item) =>
        lotKey(item.productId, toExpirationDate(item.expirationDate)),
      );
      if (new Set(keys).size !== keys.length) {
        throw new UnprocessableEntityException({
          code: "DUPLICATED_ITEM",
          message: "The counts repeat the same product and lot.",
        });
      }

      const details = new Map(
        closure.details.map((detail) => [
          lotKey(detail.productId, detail.expirationDate),
          detail,
        ]),
      );
      for (const [index, item] of items.entries()) {
        if (!details.has(keys[index])) {
          throw new UnprocessableEntityException({
            code: "PRODUCT_NOT_IN_CLOSURE",
            message: "The product lot is not part of this closure.",
            details: {
              productId: item.productId,
              expirationDate: item.expirationDate,
            },
          });
        }
      }

      const supplyIds = supplyItems.map((item) => item.supplyId);
      if (new Set(supplyIds).size !== supplyIds.length) {
        throw new UnprocessableEntityException({
          code: "DUPLICATED_SUPPLY",
          message: "The counts repeat the same supply.",
        });
      }
      const supplyDetails = new Map(
        closure.supplyDetails.map((detail) => [detail.supplyId, detail]),
      );
      for (const item of supplyItems) {
        if (!supplyDetails.has(item.supplyId)) {
          throw new UnprocessableEntityException({
            code: "SUPPLY_NOT_IN_CLOSURE",
            message: "The supply is not part of this closure.",
            details: { supplyId: item.supplyId },
          });
        }
      }

      for (const item of supplyItems) {
        const detail = supplyDetails.get(item.supplyId)!;
        const physicalQuantity = new Prisma.Decimal(item.physicalQuantity);
        await tx.inventoryClosureSupplyDetail.update({
          where: { id: detail.id },
          data: {
            physicalQuantity,
            difference: physicalQuantity.minus(detail.systemQuantity),
            observation: item.observation || null,
          },
        });
      }

      for (const [index, item] of items.entries()) {
        const detail = details.get(keys[index])!;
        await tx.inventoryClosureDetail.update({
          where: { id: detail.id },
          data: {
            physicalQuantity: item.physicalQuantity,
            difference: item.physicalQuantity - detail.systemQuantity,
            observation: item.observation || null,
          },
        });
      }

      const updated = await tx.inventoryClosure.findUniqueOrThrow({
        where: { id: closureId },
        select: CLOSURE_SELECT,
      });
      return toClosureResponse(updated, currentUser);
    });
  }

  async confirm(
    closureId: string,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
    dto: ConfirmClosureDto = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const closure = await tx.inventoryClosure.findUnique({
        where: { id: closureId },
        select: CLOSURE_SELECT,
      });
      if (!closure) throw this.notFound();
      this.assertBranchScope(closure.branchId, currentUser);
      this.assertPending(closure);

      const cashShift = await tx.cashShift.findFirst({
        where: {
          ...(dto.cashShiftId ? { id: dto.cashShiftId } : {}),
          branchId: closure.branchId,
          status: "OPEN",
        },
        orderBy: { openedAt: "desc" },
        select: { id: true },
      });
      if (!cashShift && dto.cashShiftId) {
        throw new UnprocessableEntityException({
          code: "CASH_SHIFT_NOT_ACTIVE",
          message:
            "The cash shift is not open or does not belong to the closure branch.",
          details: { cashShiftId: dto.cashShiftId },
        });
      }
      if (!cashShift) {
        throw new BadRequestException({
          code: "ACTIVE_CASH_SHIFT_REQUIRED",
          message: "An active cash shift is required to close inventory.",
        });
      }

      const pending = closure.details.filter(
        (detail) => detail.physicalQuantity === null,
      );
      const pendingSupplies = closure.supplyDetails.filter(
        (detail) => detail.physicalQuantity === null,
      );
      if (pending.length > 0 || pendingSupplies.length > 0) {
        throw new UnprocessableEntityException({
          code: "INCOMPLETE_COUNT",
          message:
            "Every lot and supply of the closure must be counted before confirming.",
          details: {
            pending: pending.map((detail) => ({
              productId: detail.productId,
              productName: detail.product.name,
              expirationDate: detail.expirationDate
                ? formatExpirationDate(detail.expirationDate)
                : null,
            })),
            pendingSupplies: pendingSupplies.map((detail) => ({
              supplyId: detail.supplyId,
              supplyName: detail.supply.name,
            })),
          },
        });
      }

      for (const detail of closure.supplyDetails) {
        await tx.inventoryClosureSupplyDetail.update({
          where: { id: detail.id },
          data: {
            difference: (
              detail.physicalQuantity ?? new Prisma.Decimal(0)
            ).minus(detail.systemQuantity),
          },
        });
      }

      for (const detail of closure.details) {
        await tx.inventoryClosureDetail.update({
          where: { id: detail.id },
          data: {
            difference: (detail.physicalQuantity ?? 0) - detail.systemQuantity,
          },
        });
      }

      const now = new Date();
      const updated = await tx.inventoryClosure.update({
        where: { id: closureId },
        data: {
          cashShiftId: cashShift.id,
          status: "CONFIRMED",
          confirmed: true,
          locked: true,
          closedAt: now,
        },
        select: CLOSURE_SELECT,
      });

      const differences = updated.details.filter(
        (detail) => detail.difference !== 0,
      ).length;
      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: "CONFIRM",
          entity: "INVENTORY_CLOSURE",
          entityId: closureId,
          oldData: { status: "PENDING" },
          newData: {
            status: "CONFIRMED",
            closureDate: formatExpirationDate(updated.closureDate),
            countedLots: updated.details.length,
            lotsWithDifference: differences,
            countedSupplies: updated.supplyDetails.length,
            suppliesWithDifference:
              updated.supplyDetails.filter(hasSupplyDifference).length,
            cashShiftId: cashShift.id,
          },
          reason: `Inventory closure of ${updated.branch.name} confirmed`,
          ipAddress,
        },
        tx,
      );

      return toClosureResponse(updated, currentUser);
    });
  }

  async findAll(query: ListClosuresQueryDto, currentUser: AuthenticatedUser) {
    const { page, limit, branchId, status, from, to } = query;

    if (isScopedRole(currentUser)) {
      if (!branchId) {
        throw new BadRequestException({
          code: "BRANCH_REQUIRED",
          message: "branchId is required for branch roles.",
        });
      }
      this.assertBranchScope(branchId, currentUser);
    }

    const where: Prisma.InventoryClosureWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(status ? { status: status as ClosureRow["status"] } : {}),
      ...(from || to
        ? {
            closureDate: {
              ...(from ? { gte: toExpirationDate(from) } : {}),
              ...(to ? { lte: toExpirationDate(to) } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;
    const [total, closures] = await this.prisma.$transaction([
      this.prisma.inventoryClosure.count({ where }),
      this.prisma.inventoryClosure.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ closureDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          branchId: true,
          closureDate: true,
          status: true,
          confirmed: true,
          locked: true,
          closedAt: true,
          branch: { select: { name: true } },
          user: {
            select: { person: { select: { firstName: true, lastName: true } } },
          },
          details: { select: { physicalQuantity: true, difference: true } },
        },
      }),
    ]);

    const showDifferences = canSeeDifferences(currentUser);
    return {
      data: closures.map((closure) => ({
        id: closure.id,
        branchId: closure.branchId,
        branchName: closure.branch.name,
        closureDate: formatExpirationDate(closure.closureDate),
        status: closure.status,
        confirmed: closure.confirmed,
        locked: closure.locked,
        closedAt: closure.closedAt,
        userName: fullName(closure.user),
        countedItems: closure.details.filter(
          (detail) => detail.physicalQuantity !== null,
        ).length,
        totalItems: closure.details.length,
        ...(showDifferences
          ? {
              totalDifferences:
                closure.status === "PENDING"
                  ? null
                  : closure.details.filter(
                      (detail) =>
                        detail.difference !== null && detail.difference !== 0,
                    ).length,
            }
          : {}),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private assertPending(closure: { status: string; locked: boolean }) {
    if (closure.status !== "PENDING" || closure.locked) {
      throw new UnprocessableEntityException({
        code: "CLOSURE_LOCKED",
        message: "The inventory closure is already confirmed or locked.",
      });
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: "CLOSURE_NOT_FOUND",
      message: "Inventory closure not found.",
    });
  }

  private assertBranchScope(branchId: string, currentUser: AuthenticatedUser) {
    if (!isScopedRole(currentUser)) return;
    const branches = currentUser.branches ?? [];
    if (!branches.some((branch) => branch.id === branchId)) {
      throw new ForbiddenException({
        code: "BRANCH_SCOPE_VIOLATION",
        message: "You do not have access to this branch.",
      });
    }
  }
}
