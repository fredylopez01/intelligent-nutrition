import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client.js";
import { SupplyMovementType } from "../../../generated/prisma/enums.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { AuditService } from "../audit/audit.service.js";
import { ListSupplyStockQueryDto } from "./dto/list-supply-stock-query.dto.js";
import { CreateSupplyStockMovementDto } from "./dto/create-supply-stock-movement.dto.js";
import { UpdateSupplyMinimumDto } from "./dto/update-supply-minimum.dto.js";

interface SupplyStockRow {
  supplyId: string;
  supplyName: string;
  unitId: string;
  unitAbbreviation: string;
  branchId: string;
  branchName: string;
  quantity: string;
  minimumQuantity: string;
  updatedAt: Date | null;
}

export function toSupplyStockResponse(row: SupplyStockRow) {
  return {
    supplyId: row.supplyId,
    supply: {
      name: row.supplyName,
      unitOfMeasure: { id: row.unitId, abbreviation: row.unitAbbreviation },
    },
    branchId: row.branchId,
    branchName: row.branchName,
    quantity: row.quantity,
    minimumQuantity: row.minimumQuantity,
    lowStock: parseFloat(row.quantity) < parseFloat(row.minimumQuantity),
    updatedAt: row.updatedAt,
  };
}

function scopeViolation(message: string) {
  return new ForbiddenException({
    code: "BRANCH_SCOPE_VIOLATION",
    message,
  });
}

@Injectable()
export class SupplyStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private stockQuery(conditions: Prisma.Sql[]) {
    const whereClause = Prisma.sql`WHERE ${Prisma.join(
      [Prisma.sql`s.active = true`, Prisma.sql`b.active = true`, ...conditions],
      " AND ",
    )}`;
    return Prisma.sql`
      FROM supply s
      CROSS JOIN branch b
      INNER JOIN unit_measure um ON um.id = s.unit_of_measure_id
      LEFT JOIN supply_stock ss ON ss.supply_id = s.id AND ss.branch_id = b.id
      ${whereClause}
    `;
  }

  private selectRows(conditions: Prisma.Sql[], pagination = Prisma.empty) {
    return this.prisma.$queryRaw<SupplyStockRow[]>`
      SELECT
        s.id                                  AS "supplyId",
        s.name                                AS "supplyName",
        um.id                                 AS "unitId",
        um.abreviation                        AS "unitAbbreviation",
        b.id                                  AS "branchId",
        b.name                                AS "branchName",
        COALESCE(ss.quantity, 0)::text        AS "quantity",
        COALESCE(ss.minimum_quantity, 0)::text AS "minimumQuantity",
        ss.updated_at                         AS "updatedAt"
      ${this.stockQuery(conditions)}
      ORDER BY s.name ASC, b.name ASC
      ${pagination}
    `;
  }

  async findAll(
    query: ListSupplyStockQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    const { branchId, search, lowStock, page, limit } = query;

    if (currentUser.role.name !== "SUPERADMIN") {
      if (!branchId) {
        throw scopeViolation("branchId is required for your role.");
      }
      const assignedIds = new Set(
        (currentUser.branches ?? []).map((b) => b.id),
      );
      if (!assignedIds.has(branchId)) {
        throw scopeViolation("You do not have access to this branch.");
      }
    }

    const conditions: Prisma.Sql[] = [];
    if (branchId) {
      conditions.push(Prisma.sql`b.id = ${branchId}::uuid`);
    }
    if (search) {
      conditions.push(Prisma.sql`s.name ILIKE ${"%" + search + "%"}`);
    }
    if (lowStock) {
      conditions.push(
        Prisma.sql`COALESCE(ss.quantity, 0) < COALESCE(ss.minimum_quantity, 0)`,
      );
    }

    const [countRows, rows] = await Promise.all([
      this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS "total" ${this.stockQuery(conditions)}
      `,
      this.selectRows(
        conditions,
        Prisma.sql`LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      ),
    ]);
    const total = Number(countRows[0]?.total ?? 0);

    return {
      data: rows.map(toSupplyStockResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private async assertSupplyAndBranch(branchId: string, supplyId: string) {
    const [supply, branch] = await Promise.all([
      this.prisma.supply.findUnique({
        where: { id: supplyId },
        select: { name: true, active: true },
      }),
      this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { active: true },
      }),
    ]);
    if (!supply) {
      throw new NotFoundException({
        code: "SUPPLY_NOT_FOUND",
        message: "Supply not found.",
      });
    }
    if (!supply.active) {
      throw new UnprocessableEntityException({
        code: "SUPPLY_INACTIVE",
        message: `Supply "${supply.name}" is inactive.`,
      });
    }
    if (!branch) {
      throw new NotFoundException({
        code: "BRANCH_NOT_FOUND",
        message: "Branch not found.",
      });
    }
    if (!branch.active) {
      throw new UnprocessableEntityException({
        code: "BRANCH_INACTIVE",
        message: "The branch is inactive.",
      });
    }
    return supply;
  }

  async createMovement(
    dto: CreateSupplyStockMovementDto,
    currentUser: AuthenticatedUser,
  ) {
    const { branchId, supplyId, movementType, quantity, observation } = dto;

    await this.assertSupplyAndBranch(branchId, supplyId);

    return this.prisma.$transaction(async (tx) => {
      let resultingQuantity: Prisma.Decimal;

      if (movementType === SupplyMovementType.ENTRY) {
        const updated = await tx.supplyStock.upsert({
          where: { branchId_supplyId: { branchId, supplyId } },
          create: { branchId, supplyId, quantity },
          update: { quantity: { increment: quantity } },
          select: { quantity: true },
        });
        resultingQuantity = updated.quantity;
      } else {
        const result = await tx.supplyStock.updateMany({
          where: { branchId, supplyId, quantity: { gte: quantity } },
          data: { quantity: { decrement: quantity } },
        });
        const stock = await tx.supplyStock.findUnique({
          where: { branchId_supplyId: { branchId, supplyId } },
          select: { quantity: true },
        });
        if (result.count === 0) {
          throw new UnprocessableEntityException({
            code: "INSUFFICIENT_SUPPLY_STOCK",
            message: "Insufficient supply stock for this exit movement.",
            details: {
              available: stock?.quantity.toString() ?? "0",
              requested: quantity,
            },
          });
        }
        resultingQuantity = stock!.quantity;
      }

      const movement = await tx.supplyStockMovement.create({
        data: {
          branchId,
          supplyId,
          movementType,
          quantity,
          observation: observation?.trim() || null,
          userId: currentUser.id,
        },
        select: {
          id: true,
          movementType: true,
          quantity: true,
          observation: true,
          movementAt: true,
          supply: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          user: {
            select: {
              personId: true,
              person: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      const fullName = [
        movement.user.person.firstName,
        movement.user.person.lastName,
      ]
        .filter(Boolean)
        .join(" ");

      return {
        id: movement.id,
        movementType: movement.movementType,
        quantity: movement.quantity.toString(),
        supply: movement.supply,
        branch: movement.branch,
        user: { id: movement.user.personId, fullName: fullName || null },
        observation: movement.observation,
        resultingQuantity: resultingQuantity.toString(),
        movementAt: movement.movementAt,
      };
    });
  }

  async updateMinimum(
    dto: UpdateSupplyMinimumDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const { branchId, supplyId, minimumQuantity } = dto;
    const supply = await this.assertSupplyAndBranch(branchId, supplyId);

    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.supplyStock.findUnique({
        where: { branchId_supplyId: { branchId, supplyId } },
        select: { minimumQuantity: true },
      });
      const minimum = new Prisma.Decimal(minimumQuantity);
      await tx.supplyStock.upsert({
        where: { branchId_supplyId: { branchId, supplyId } },
        create: { branchId, supplyId, minimumQuantity: minimum },
        update: { minimumQuantity: minimum },
      });

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: "UPDATE",
          entity: "SUPPLY_STOCK",
          entityId: supplyId,
          oldData: {
            branchId,
            minimumQuantity: previous?.minimumQuantity.toString() ?? "0",
          },
          newData: { branchId, minimumQuantity: minimum.toString() },
          reason: `Stock mínimo del insumo ${supply.name}`,
          ipAddress,
        },
        tx,
      );

      const [row] = await tx.$queryRaw<SupplyStockRow[]>`
        SELECT
          s.id                                  AS "supplyId",
          s.name                                AS "supplyName",
          um.id                                 AS "unitId",
          um.abreviation                        AS "unitAbbreviation",
          b.id                                  AS "branchId",
          b.name                                AS "branchName",
          COALESCE(ss.quantity, 0)::text        AS "quantity",
          COALESCE(ss.minimum_quantity, 0)::text AS "minimumQuantity",
          ss.updated_at                         AS "updatedAt"
        FROM supply s
        CROSS JOIN branch b
        INNER JOIN unit_measure um ON um.id = s.unit_of_measure_id
        LEFT JOIN supply_stock ss ON ss.supply_id = s.id AND ss.branch_id = b.id
        WHERE s.id = ${supplyId}::uuid AND b.id = ${branchId}::uuid
      `;
      return toSupplyStockResponse(row);
    });
  }
}
