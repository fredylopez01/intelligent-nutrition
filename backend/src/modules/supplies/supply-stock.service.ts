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
import { ListSupplyStockQueryDto } from "./dto/list-supply-stock-query.dto.js";
import { CreateSupplyStockMovementDto } from "./dto/create-supply-stock-movement.dto.js";

interface SupplyStockRow {
  supplyId: string;
  supplyName: string;
  unitAbreviation: string;
  branchId: string;
  quantity: string;
  minimumQuantity: string;
  updatedAt: Date;
}

@Injectable()
export class SupplyStockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListSupplyStockQueryDto, currentUser: AuthenticatedUser) {
    const { branchId, search, lowStock } = query;

    if (currentUser.role.name !== "SUPERADMIN") {
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

    const conditions: Prisma.Sql[] = [];
    if (branchId) {
      conditions.push(Prisma.sql`ss.branch_id = ${branchId}::uuid`);
    }
    if (search) {
      conditions.push(Prisma.sql`s.name ILIKE ${"%" + search + "%"}`);
    }
    if (lowStock) {
      conditions.push(Prisma.sql`ss.quantity < ss.minimum_quantity`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<SupplyStockRow[]>`
      SELECT
        ss.supply_id      AS "supplyId",
        s.name            AS "supplyName",
        um.abreviation    AS "unitAbreviation",
        ss.branch_id      AS "branchId",
        ss.quantity::text AS "quantity",
        ss.minimum_quantity::text AS "minimumQuantity",
        ss.updated_at     AS "updatedAt"
      FROM supply_stock ss
      INNER JOIN supply s      ON s.id = ss.supply_id
      INNER JOIN unit_measure um ON um.id = s.unit_of_measure_id
      ${whereClause}
      ORDER BY s.name ASC
    `;

    return {
      data: rows.map((r) => ({
        supplyId: r.supplyId,
        supply: {
          name: r.supplyName,
          unitOfMeasure: { abreviation: r.unitAbreviation },
        },
        branchId: r.branchId,
        quantity: r.quantity,
        minimumQuantity: r.minimumQuantity,
        lowStock: parseFloat(r.quantity) < parseFloat(r.minimumQuantity),
        updatedAt: r.updatedAt,
      })),
    };
  }

  async createMovement(
    dto: CreateSupplyStockMovementDto,
    currentUser: AuthenticatedUser,
    _ipAddress?: string,
  ) {
    const { branchId, supplyId, movementType, quantity, observation } = dto;

    const stock = await this.prisma.supplyStock.findUnique({
      where: { branchId_supplyId: { branchId, supplyId } },
    });
    if (!stock) {
      throw new NotFoundException({
        code: "SUPPLY_NOT_ASSIGNED",
        message: "The supply is not assigned to this branch.",
      });
    }

    if (movementType === SupplyMovementType.EXIT) {
      if (stock.quantity.lessThan(quantity)) {
        throw new UnprocessableEntityException({
          code: "INSUFFICIENT_SUPPLY_STOCK",
          message: "Insufficient supply stock for this exit movement.",
          details: {
            available: stock.quantity,
            requested: quantity,
          },
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const delta =
        movementType === SupplyMovementType.ENTRY ? quantity : -quantity;

      const updatedStock = await tx.supplyStock.update({
        where: { branchId_supplyId: { branchId, supplyId } },
        data: { quantity: { increment: delta } },
        select: { quantity: true },
      });

      const movement = await tx.supplyStockMovement.create({
        data: {
          branchId,
          supplyId,
          movementType,
          quantity,
          observation: observation ?? null,
          userId: currentUser.id,
        },
        select: {
          id: true,
          movementType: true,
          quantity: true,
          observation: true,
          movementAt: true,
          supply: {
            select: {
              id: true,
              name: true,
              unitOfMeasure: { select: { abreviation: true } },
            },
          },
          branch: { select: { id: true, name: true } },
          user: {
            select: {
              personId: true,
              person: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      return {
        id: movement.id,
        movementType: movement.movementType,
        quantity: movement.quantity,
        supply: movement.supply,
        branch: movement.branch,
        user: movement.user,
        observation: movement.observation,
        resultingQuantity: updatedStock.quantity,
        movementAt: movement.movementAt,
      };
    });
  }
}
