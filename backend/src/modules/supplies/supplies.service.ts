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

interface SupplyWithUnit {
  unitOfMeasure: { id: string; name: string; abreviation: string };
  productUnitQuantity?: unknown;
}

export const SUPPLY_LINK_SELECT = {
  productUnitQuantity: true,
  sourceProduct: { select: { id: true, name: true, referenceCode: true } },
} as const;

export function formatSupply<T extends SupplyWithUnit>(supply: T) {
  const { abreviation, ...unit } = supply.unitOfMeasure;
  return {
    ...supply,
    unitOfMeasure: { ...unit, abbreviation: abreviation },
    ...("productUnitQuantity" in supply
      ? {
          productUnitQuantity:
            supply.productUnitQuantity === null ||
            supply.productUnitQuantity === undefined
              ? null
              : Number(supply.productUnitQuantity),
        }
      : {}),
  };
}

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
    const { unitOfMeasureId } = dto;
    const product = await this.assertSourceProduct(dto.sourceProductId);
    const name = product ? product.name : (dto.name ?? "").trim();
    if (!name) {
      throw new BadRequestException({
        code: "SUPPLY_NAME_REQUIRED",
        message: "The name is required when the supply does not come from a product.",
      });
    }

    await this.assertNameAvailable(name);

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
        data: {
          name,
          unitOfMeasureId,
          ...(dto.sourceProductId
            ? {
                sourceProductId: dto.sourceProductId,
                productUnitQuantity: dto.productUnitQuantity,
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          unitOfMeasure: { select: { id: true, name: true, abreviation: true } },
          active: true,
          createdAt: true,
          updatedAt: true,
          ...SUPPLY_LINK_SELECT,
        },
      });

      const branches = await tx.branch.findMany({
        where: { active: true },
        select: { id: true },
      });
      if (branches.length > 0) {
        await tx.supplyStock.createMany({
          data: branches.map((branch) => ({
            branchId: branch.id,
            supplyId: supply.id,
          })),
          skipDuplicates: true,
        });
      }

      const response = formatSupply(supply);
      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: "CREATE",
          entity: "SUPPLY",
          entityId: supply.id,
          newData: response,
          reason: `Creación del insumo ${supply.name}`,
          ipAddress,
        },
        tx,
      );

      return response;
    });
  }

  private async assertNameAvailable(name: string, supplyId?: string) {
    const conflict = await this.prisma.supply.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(supplyId ? { id: { not: supplyId } } : {}),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new ConflictException({
        code: "SUPPLY_NAME_ALREADY_EXISTS",
        message: "A supply with this name already exists.",
        details: { name },
      });
    }
  }

  private async assertSourceProduct(
    productId: string | undefined | null,
    supplyId?: string,
  ): Promise<{ id: string; name: string } | null> {
    if (!productId) return null;
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        active: true,
        recipe: { select: { id: true, name: true } },
        derivedSupply: { select: { id: true, name: true, active: true } },
      },
    });
    if (!product) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found.",
      });
    }
    if (!product.active) {
      throw new UnprocessableEntityException({
        code: "PRODUCT_INACTIVE",
        message: `Product "${product.name}" is inactive.`,
      });
    }
    if (product.recipe) {
      throw new UnprocessableEntityException({
        code: "PRODUCT_IS_PREPARED",
        message: `Product "${product.name}" is prepared with the recipe "${product.recipe.name}", so it cannot become a supply.`,
        details: { productId, recipeId: product.recipe.id, recipeName: product.recipe.name },
      });
    }
    if (product.derivedSupply && product.derivedSupply.id !== supplyId) {
      throw new ConflictException({
        code: "PRODUCT_ALREADY_LINKED",
        message: `Product "${product.name}" is already the supply "${product.derivedSupply.name}".`,
        details: {
          productId,
          supplyId: product.derivedSupply.id,
          supplyName: product.derivedSupply.name,
          supplyActive: product.derivedSupply.active,
        },
      });
    }
    return { id: product.id, name: product.name };
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
          ...SUPPLY_LINK_SELECT,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      data: supplies.map(formatSupply),
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
        ...SUPPLY_LINK_SELECT,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!supply) {
      throw new NotFoundException("Supply not found.");
    }
    return formatSupply(supply);
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

    const product =
      typeof dto.sourceProductId === "string"
        ? await this.assertSourceProduct(dto.sourceProductId, supplyId)
        : null;
    const linkedAfter =
      dto.sourceProductId === null
        ? false
        : product !== null || existing.sourceProductId !== null;

    if (dto.name !== undefined && linkedAfter && dto.name !== (product?.name ?? existing.name)) {
      throw new UnprocessableEntityException({
        code: "SUPPLY_NAME_FROM_PRODUCT",
        message: "The name of a supply that comes from a product follows the product name.",
      });
    }

    const nextName = product?.name ?? dto.name;
    if (nextName !== undefined && nextName !== existing.name) {
      await this.assertNameAvailable(nextName, supplyId);
    }
    if (
      dto.productUnitQuantity !== undefined &&
      dto.sourceProductId === undefined &&
      !existing.sourceProductId
    ) {
      throw new UnprocessableEntityException({
        code: "SUPPLY_NOT_LINKED",
        message: "Link the supply to a product before setting its quantity.",
      });
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
          ...(nextName !== undefined ? { name: nextName } : {}),
          ...(dto.unitOfMeasureId !== undefined ? { unitOfMeasureId: dto.unitOfMeasureId } : {}),
          ...(dto.sourceProductId === null
            ? { sourceProductId: null, productUnitQuantity: null }
            : {}),
          ...(typeof dto.sourceProductId === "string"
            ? { sourceProductId: dto.sourceProductId }
            : {}),
          ...(dto.productUnitQuantity !== undefined &&
          dto.sourceProductId !== null
            ? { productUnitQuantity: dto.productUnitQuantity }
            : {}),
        },
        select: {
          id: true,
          name: true,
          unitOfMeasure: { select: { id: true, name: true, abreviation: true } },
          active: true,
          updatedAt: true,
          ...SUPPLY_LINK_SELECT,
        },
      });

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: "UPDATE",
          entity: "SUPPLY",
          entityId: supplyId,
          oldData: existing,
          newData: formatSupply(updated),
          reason: `Actualización del insumo ${updated.name}`,
          ipAddress,
        },
        tx,
      );

      return formatSupply(updated);
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
