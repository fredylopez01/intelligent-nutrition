import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { CreateSupplyDto } from "./dto/create-supply.dto.js";
import { UpdateSupplyDto } from "./dto/update-supply.dto.js";
import { ListSuppliesQueryDto } from "./dto/list-supplies-query.dto.js";

@Injectable()
export class SuppliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateSupplyDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const { name, unitOfMeasureId } = dto;

    const existing = await this.prisma.supply.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: "SUPPLY_NAME_ALREADY_EXISTS",
        message: "A supply with this name already exists.",
      });
    }

    const unit = await this.prisma.unitMeasure.findUnique({
      where: { id: unitOfMeasureId },
      select: { id: true, active: true },
    });
    if (!unit) {
      throw new NotFoundException("Unit of measure not found.");
    }
    if (!unit.active) {
      throw new UnprocessableEntityException({
        code: "UNIT_INACTIVE",
        message: "The selected unit of measure is inactive.",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const supply = await tx.supply.create({
        data: { name, unitOfMeasureId },
        select: {
          id: true,
          name: true,
          unitOfMeasure: { select: { id: true, name: true, abreviation: true } },
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: "CREATE",
          entity: "SUPPLY",
          entityId: supply.id,
          newData: supply,
          reason: `Creación del insumo ${supply.name}`,
          ipAddress,
        },
        tx,
      );

      return supply;
    });
  }

  async findAll(query: ListSuppliesQueryDto) {
    const { page, limit, active, search } = query;

    const where = {
      ...(active === undefined ? {} : { active }),
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [total, supplies] = await this.prisma.$transaction([
      this.prisma.supply.count({ where }),
      this.prisma.supply.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          unitOfMeasure: { select: { id: true, name: true, abreviation: true } },
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      data: supplies,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(supplyId: string) {
    const supply = await this.prisma.supply.findUnique({
      where: { id: supplyId },
      select: {
        id: true,
        name: true,
        unitOfMeasure: { select: { id: true, name: true, abreviation: true } },
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!supply) {
      throw new NotFoundException("Supply not found.");
    }
    return supply;
  }

  async update(
    supplyId: string,
    dto: UpdateSupplyDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    if (Object.values(dto).every((v) => v === undefined)) {
      throw new BadRequestException("At least one field must be provided.");
    }

    const existing = await this.prisma.supply.findUnique({
      where: { id: supplyId },
    });
    if (!existing) {
      throw new NotFoundException("Supply not found.");
    }

    if (dto.name !== undefined && dto.name !== existing.name) {
      const conflict = await this.prisma.supply.findFirst({
        where: { name: { equals: dto.name, mode: "insensitive" }, id: { not: supplyId } },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException({
          code: "SUPPLY_NAME_ALREADY_EXISTS",
          message: "A supply with this name already exists.",
        });
      }
    }

    if (dto.unitOfMeasureId !== undefined) {
      const unit = await this.prisma.unitMeasure.findUnique({
        where: { id: dto.unitOfMeasureId },
        select: { id: true, active: true },
      });
      if (!unit) {
        throw new NotFoundException("Unit of measure not found.");
      }
      if (!unit.active) {
        throw new UnprocessableEntityException({
          code: "UNIT_INACTIVE",
          message: "The selected unit of measure is inactive.",
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supply.update({
        where: { id: supplyId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.unitOfMeasureId !== undefined ? { unitOfMeasureId: dto.unitOfMeasureId } : {}),
        },
        select: {
          id: true,
          name: true,
          unitOfMeasure: { select: { id: true, name: true, abreviation: true } },
          active: true,
          updatedAt: true,
        },
      });

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: "UPDATE",
          entity: "SUPPLY",
          entityId: supplyId,
          oldData: existing,
          newData: updated,
          reason: `Actualización del insumo ${updated.name}`,
          ipAddress,
        },
        tx,
      );

      return updated;
    });
  }

  async updateStatus(
    supplyId: string,
    active: boolean,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.prisma.supply.findUnique({
        where: { id: supplyId },
        select: { name: true, active: true },
      });
      if (!existing) {
        throw new NotFoundException("Supply not found.");
      }
      if (existing.active === active) {
        throw new ConflictException({
          code: "ALREADY_IN_STATE",
          message: "Supply is already in the requested state.",
        });
      }

      await tx.supply.update({ where: { id: supplyId }, data: { active } });

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: active ? "ACTIVATE" : "DEACTIVATE",
          entity: "SUPPLY",
          entityId: supplyId,
          oldData: { active: existing.active },
          newData: { active },
          reason: `${active ? "Activación" : "Desactivación"} del insumo ${existing.name}`,
          ipAddress,
        },
        tx,
      );

      return { message: "Supply status updated successfully." };
    });
  }
}
