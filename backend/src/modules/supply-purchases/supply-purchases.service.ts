import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { businessDate } from "../../common/utils/business-day.util.js";
import { AuditService } from "../audit/audit.service.js";
import { CreateSupplyPurchaseDto } from "./dto/create-supply-purchase.dto.js";
import { ListSupplyPurchasesQueryDto } from "./dto/list-supply-purchases-query.dto.js";
import { ReceiveSupplyPurchaseDto } from "./dto/receive-supply-purchase.dto.js";

const SCOPED_ROLES = new Set(["BRANCH_LEADER", "BRANCH_ASSISTANT"]);

const purchaseSelect = {
  id: true,
  purchaseNumber: true,
  status: true,
  purchaseAt: true,
  total: true,
  observation: true,
  supplier: {
    select: {
      personId: true,
      commercialName: true,
      person: {
        select: { firstName: true, lastName: true, businessName: true },
      },
    },
  },
  user: {
    select: {
      personId: true,
      person: { select: { firstName: true, lastName: true } },
    },
  },
  details: {
    orderBy: { supply: { name: "asc" } },
    select: {
      id: true,
      requestedQuantity: true,
      receivedQuantity: true,
      unitCost: true,
      subtotal: true,
      supply: {
        select: {
          id: true,
          name: true,
          unitOfMeasure: { select: { name: true, abreviation: true } },
        },
      },
    },
  },
} satisfies Prisma.SupplyPurchaseSelect;

type PurchaseRow = Prisma.SupplyPurchaseGetPayload<{
  select: typeof purchaseSelect;
}>;
type Tx = Prisma.TransactionClient;

const toMilli = (value: unknown) => Math.round(Number(value) * 1000);
const fromMilli = (value: number) => Number((value / 1000).toFixed(3));
const toCents = (value: unknown) => Math.round(Number(value) * 100);
const toMoney = (cents: number) => (cents / 100).toFixed(2);

function supplierName(row: PurchaseRow["supplier"]): string {
  return (
    row.commercialName ||
    row.person.businessName ||
    [row.person.firstName, row.person.lastName].filter(Boolean).join(" ")
  );
}

@Injectable()
export class SupplyPurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private format(row: PurchaseRow) {
    return {
      id: row.id,
      purchaseNumber: row.purchaseNumber,
      status: row.status,
      purchaseAt: row.purchaseAt,
      total: Number(row.total).toFixed(2),
      observation: row.observation,
      supplier: { id: row.supplier.personId, name: supplierName(row.supplier) },
      user: {
        id: row.user.personId,
        fullName: [row.user.person.firstName, row.user.person.lastName]
          .filter(Boolean)
          .join(" "),
      },
      items: row.details.map((detail) => ({
        id: detail.id,
        supply: {
          id: detail.supply.id,
          name: detail.supply.name,
          unit: detail.supply.unitOfMeasure.abreviation,
          unitName: detail.supply.unitOfMeasure.name,
        },
        requestedQuantity: Number(detail.requestedQuantity),
        receivedQuantity: Number(detail.receivedQuantity),
        pendingQuantity: fromMilli(
          toMilli(detail.requestedQuantity) - toMilli(detail.receivedQuantity),
        ),
        unitCost: Number(detail.unitCost).toFixed(2),
        subtotal: Number(detail.subtotal).toFixed(2),
      })),
    };
  }

  private async nextNumber(tx: Tx, now: Date): Promise<string> {
    const day = businessDate(now).toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `CI-${day}-`;
    const last = await tx.supplyPurchase.findFirst({
      where: { purchaseNumber: { startsWith: prefix } },
      orderBy: { purchaseNumber: "desc" },
      select: { purchaseNumber: true },
    });
    const next = last
      ? Number(last.purchaseNumber.slice(prefix.length)) + 1
      : 1;
    return `${prefix}${String(next).padStart(4, "0")}`;
  }

  async create(
    dto: CreateSupplyPurchaseDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const supplyIds = dto.items.map((item) => item.supplyId);
    if (new Set(supplyIds).size !== supplyIds.length) {
      throw new UnprocessableEntityException({
        code: "DUPLICATED_SUPPLY",
        message: "Each supply can only appear once in the purchase.",
      });
    }
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { personId: dto.supplierId },
        select: { active: true },
      });
      if (!supplier) {
        throw new NotFoundException({
          code: "SUPPLIER_NOT_FOUND",
          message: "Supplier not found.",
        });
      }
      if (!supplier.active) {
        throw new UnprocessableEntityException({
          code: "SUPPLIER_INACTIVE",
          message: "Supplier is inactive.",
        });
      }
      const supplies = await tx.supply.findMany({
        where: { id: { in: supplyIds } },
        select: { id: true, name: true, active: true },
      });
      const byId = new Map(supplies.map((supply) => [supply.id, supply]));
      for (const id of supplyIds) {
        const supply = byId.get(id);
        if (!supply) {
          throw new NotFoundException({
            code: "SUPPLY_NOT_FOUND",
            message: `Supply ${id} not found.`,
          });
        }
        if (!supply.active) {
          throw new UnprocessableEntityException({
            code: "SUPPLY_INACTIVE",
            message: `Supply "${supply.name}" is inactive.`,
          });
        }
      }
      const lines = dto.items.map((item) => {
        const subtotalCents = Math.round(
          (toCents(item.unitCost) * toMilli(item.quantity)) / 1000,
        );
        return {
          supplyId: item.supplyId,
          requestedQuantity: fromMilli(toMilli(item.quantity)),
          unitCost: item.unitCost,
          subtotal: toMoney(subtotalCents),
          cents: subtotalCents,
        };
      });
      const created = await tx.supplyPurchase.create({
        data: {
          purchaseNumber: await this.nextNumber(tx, now),
          supplierId: dto.supplierId,
          userId: user.id,
          purchaseAt: now,
          total: toMoney(lines.reduce((sum, line) => sum + line.cents, 0)),
          observation: dto.observation || null,
          details: {
            create: lines.map((line) => ({
              supplyId: line.supplyId,
              requestedQuantity: line.requestedQuantity,
              unitCost: line.unitCost,
              subtotal: line.subtotal,
            })),
          },
        },
        select: purchaseSelect,
      });
      await this.auditService.createAuditLog(
        {
          userId: user.id,
          action: "CREATE",
          entity: "SUPPLY_PURCHASE",
          entityId: created.id,
          newData: {
            purchaseNumber: created.purchaseNumber,
            total: created.total.toString(),
          },
          reason: `Compra de insumos ${created.purchaseNumber}`,
          ipAddress,
        },
        tx,
      );
      return this.format(created);
    });
  }

  async findAll(query: ListSupplyPurchasesQueryDto) {
    const { page, limit, status, supplierId, search } = query;
    const where: Prisma.SupplyPurchaseWhereInput = {
      ...(status ? { status } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(search
        ? { purchaseNumber: { contains: search, mode: "insensitive" } }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.supplyPurchase.count({ where }),
      this.prisma.supplyPurchase.findMany({
        where,
        orderBy: { purchaseAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: purchaseSelect,
      }),
    ]);
    return {
      data: rows.map((row) => this.format(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private async load(client: Tx | PrismaService, id: string) {
    const row = await client.supplyPurchase.findUnique({
      where: { id },
      select: purchaseSelect,
    });
    if (!row) {
      throw new NotFoundException({
        code: "SUPPLY_PURCHASE_NOT_FOUND",
        message: "Supply purchase not found.",
      });
    }
    return row;
  }

  async findOne(id: string) {
    return this.format(await this.load(this.prisma, id));
  }

  async receive(
    id: string,
    dto: ReceiveSupplyPurchaseDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    if (
      SCOPED_ROLES.has(user.role.name) &&
      !(user.branches ?? []).some((branch) => branch.id === dto.branchId)
    ) {
      throw new ForbiddenException({
        code: "BRANCH_SCOPE_VIOLATION",
        message: "You do not have access to this branch.",
        details: { branchId: dto.branchId },
      });
    }
    const detailIds = dto.items.map((item) => item.detailId);
    if (new Set(detailIds).size !== detailIds.length) {
      throw new UnprocessableEntityException({
        code: "DUPLICATED_LINE",
        message: "Each line can only appear once in the receipt.",
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: dto.branchId },
        select: { id: true, name: true, active: true },
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
      await tx.$queryRaw`SELECT id FROM supply_purchase WHERE id = ${id}::uuid FOR UPDATE`;
      const purchase = await this.load(tx, id);
      if (purchase.status === "FULLY_RECEIVED") {
        throw new ConflictException({
          code: "PURCHASE_ALREADY_RECEIVED",
          message: "The purchase was already received completely.",
        });
      }
      const details = new Map(
        purchase.details.map((detail) => [detail.id, detail]),
      );
      for (const item of dto.items) {
        const detail = details.get(item.detailId);
        if (!detail) {
          throw new NotFoundException({
            code: "PURCHASE_LINE_NOT_FOUND",
            message: `Line ${item.detailId} does not belong to the purchase.`,
          });
        }
        const pending =
          toMilli(detail.requestedQuantity) - toMilli(detail.receivedQuantity);
        if (toMilli(item.quantity) > pending) {
          throw new UnprocessableEntityException({
            code: "QUANTITY_EXCEEDS_PENDING",
            message: `Only ${fromMilli(pending)} ${detail.supply.unitOfMeasure.abreviation} of "${detail.supply.name}" are pending.`,
            details: { detailId: detail.id, pending: fromMilli(pending) },
          });
        }
      }
      for (const item of dto.items) {
        const detail = details.get(item.detailId)!;
        const quantity = fromMilli(toMilli(item.quantity));
        await tx.supplyPurchaseDetail.update({
          where: { id: detail.id },
          data: { receivedQuantity: { increment: quantity } },
        });
        await tx.supplyStock.upsert({
          where: {
            branchId_supplyId: {
              branchId: branch.id,
              supplyId: detail.supply.id,
            },
          },
          update: { quantity: { increment: quantity } },
          create: { branchId: branch.id, supplyId: detail.supply.id, quantity },
        });
        await tx.supplyStockMovement.create({
          data: {
            branchId: branch.id,
            supplyId: detail.supply.id,
            movementType: "ENTRY",
            quantity,
            observation: `Compra ${purchase.purchaseNumber}${dto.observation ? ` · ${dto.observation}` : ""}`,
            userId: user.id,
          },
        });
      }
      const refreshed = await tx.supplyPurchaseDetail.findMany({
        where: { purchaseId: id },
        select: { requestedQuantity: true, receivedQuantity: true },
      });
      const complete = refreshed.every(
        (detail) =>
          toMilli(detail.receivedQuantity) >= toMilli(detail.requestedQuantity),
      );
      await tx.supplyPurchase.update({
        where: { id },
        data: { status: complete ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED" },
      });
      await this.auditService.createAuditLog(
        {
          userId: user.id,
          action: "RECEIVE",
          entity: "SUPPLY_PURCHASE",
          entityId: id,
          oldData: { status: purchase.status },
          newData: {
            status: complete ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED",
            branchId: branch.id,
            items: dto.items,
          },
          reason: `Recepción de la compra de insumos ${purchase.purchaseNumber} en ${branch.name}`,
          ipAddress,
        },
        tx,
      );
      return this.format(await this.load(tx, id));
    });
  }
}
