import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { normalizeSearchTerm } from "../../common/utils/search.util.js";
import { AuditService } from "../audit/audit.service.js";
import { CreateBranchDto } from "./dto/create-branch.dto.js";
import { ListBranchesQueryDto } from "./dto/list-branches-query.dto.js";
import { ListSellableProductsQueryDto } from "./dto/list-sellable-products-query.dto.js";
import { startOfTodayUtc } from "../../common/utils/expiration.util.js";
import { UpdateBranchDto } from "./dto/update-branch.dto.js";
import { UpdateBranchScheduleDto } from "./dto/update-branch-schedule.dto.js";
import {
  reservationKey,
  reservedUnits,
} from "../../common/utils/stock-reservations.util.js";
import {
  groupSchedule,
  isOpenAt,
  toMinutes,
  type ScheduleRow,
} from "../../common/utils/branch-schedule.util.js";

const SCHEDULE_SELECT = {
  select: { dayOfWeek: true, opensAt: true, closesAt: true },
} as const;

function withSchedule<T extends { active: boolean; schedules: ScheduleRow[] }>(
  branch: T,
  now = new Date(),
) {
  const { schedules, ...rest } = branch;
  return {
    ...rest,
    schedule: groupSchedule(schedules),
    openNow: branch.active && isOpenAt(schedules, now),
  };
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private getPrimaryImageUrl(
    images: Array<{ url: string; isPrimary: boolean; sortOrder: number }>,
  ) {
    if (images.length === 0) {
      return null;
    }

    const primaryImage = images.find((image) => image.isPrimary);
    if (primaryImage) {
      return primaryImage.url;
    }

    const [sortedImage] = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
    return sortedImage?.url ?? null;
  }

  async findAll(query: ListBranchesQueryDto) {
    const { page, limit, search, active } = query;
    const skip = (page - 1) * limit;
    const where = {
      ...(active === undefined ? {} : { active }),
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const [total, branches] = await this.prisma.$transaction([
      this.prisma.branch.count({ where }),
      this.prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          active: true,
          deliveryEnabled: true,
          schedules: SCHEDULE_SELECT,
        },
      }),
    ]);

    const now = new Date();
    return {
      data: branches.map((branch) => withSchedule(branch, now)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        active: true,
        deliveryEnabled: true,
        schedules: SCHEDULE_SELECT,
      },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    return withSchedule(branch);
  }

  async updateSchedule(
    id: string,
    dto: UpdateBranchScheduleDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const seenDays = new Set<number>();
    const rows: ScheduleRow[] = [];
    for (const day of dto.days) {
      if (seenDays.has(day.dayOfWeek)) {
        throw new BadRequestException({
          code: "DUPLICATED_DAY",
          message: `Day ${day.dayOfWeek} is repeated.`,
        });
      }
      seenDays.add(day.dayOfWeek);
      const intervals = [...day.intervals].sort(
        (a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt),
      );
      intervals.forEach((interval, index) => {
        if (toMinutes(interval.opensAt) >= toMinutes(interval.closesAt)) {
          throw new BadRequestException({
            code: "INVALID_INTERVAL",
            message: `The interval ${interval.opensAt}-${interval.closesAt} must close after it opens.`,
          });
        }
        const previous = intervals[index - 1];
        if (
          previous &&
          toMinutes(interval.opensAt) < toMinutes(previous.closesAt)
        ) {
          throw new BadRequestException({
            code: "OVERLAPPING_INTERVALS",
            message: `The intervals of day ${day.dayOfWeek} overlap.`,
          });
        }
        rows.push({ dayOfWeek: day.dayOfWeek, ...interval });
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const branch = await transaction.branch.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          active: true,
          deliveryEnabled: true,
          schedules: SCHEDULE_SELECT,
        },
      });

      if (!branch) {
        throw new NotFoundException("Branch not found");
      }

      await transaction.branchSchedule.deleteMany({ where: { branchId: id } });
      if (rows.length > 0) {
        await transaction.branchSchedule.createMany({
          data: rows.map((row) => ({ branchId: id, ...row })),
        });
      }

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: "UPDATE",
          entity: "BRANCH",
          entityId: id,
          oldData: { schedule: groupSchedule(branch.schedules) },
          newData: { schedule: groupSchedule(rows) },
          reason: `Actualización del horario de la sede ${branch.name}`,
          ipAddress,
        },
        transaction,
      );

      return withSchedule({ ...branch, schedules: rows });
    });
  }

  async update(
    id: string,
    updateBranchDto: UpdateBranchDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    if (Object.values(updateBranchDto).every((value) => value === undefined)) {
      throw new BadRequestException("At least one field must be provided");
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existingBranch = await transaction.branch.findUnique({
          where: { id },
        });

        if (!existingBranch) {
          throw new NotFoundException("Branch not found");
        }

        const { name, address, phone, deliveryEnabled } = updateBranchDto;
        if (name !== undefined && name !== existingBranch.name) {
          const branchWithSameName = await transaction.branch.findUnique({
            where: { name },
            select: { id: true },
          });

          if (branchWithSameName) {
            throw new ConflictException("Branch name already exists");
          }
        }

        const updatedBranch = await transaction.branch.update({
          where: { id },
          data: {
            ...(name === undefined ? {} : { name }),
            ...(address === undefined ? {} : { address }),
            ...(phone === undefined ? {} : { phone }),
            ...(deliveryEnabled === undefined ? {} : { deliveryEnabled }),
          },
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            active: true,
            deliveryEnabled: true,
          },
        });

        if (existingBranch !== updatedBranch) {
          await this.auditService.createAuditLog(
            {
              userId: currentUser.id,
              action: "UPDATE",
              entity: "BRANCH",
              entityId: id,
              oldData: existingBranch,
              newData: updatedBranch,
              reason: `Actualización de la sede ${updatedBranch.name}`,
              ipAddress,
            },
            transaction,
          );
        }

        return updatedBranch;
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2002"
      ) {
        throw new ConflictException("Branch name already exists");
      }

      throw error;
    }
  }

  async updateStatus(
    id: string,
    active: boolean,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const existingBranch = await transaction.branch.findUnique({
        where: { id },
        select: { id: true, name: true, active: true },
      });

      if (!existingBranch) {
        throw new NotFoundException("Branch not found");
      }

      if (existingBranch.active === active) {
        throw new BadRequestException(
          `Branch is already ${active ? "active" : "inactive"}`,
        );
      }

      const updateResult = await transaction.branch.updateMany({
        where: { id, active: existingBranch.active },
        data: { active },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException("Branch status has already changed");
      }

      const updatedBranch = await transaction.branch.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          active: true,
          deliveryEnabled: true,
        },
      });

      if (!updatedBranch) {
        throw new NotFoundException("Branch not found");
      }

      await this.auditService.createAuditLog(
        {
          userId: currentUser.id,
          action: active ? "ACTIVATE" : "DEACTIVATE",
          entity: "BRANCH",
          entityId: id,
          oldData: { active: existingBranch.active },
          newData: { active },
          reason: `${active ? "Activación" : "Desactivación"} de la sede ${existingBranch.name}`,
          ipAddress,
        },
        transaction,
      );

      return updatedBranch;
    });
  }

  async create(
    createBranchDto: CreateBranchDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const { name, address, phone } = createBranchDto;

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existingBranch = await transaction.branch.findUnique({
          where: { name },
          select: { id: true },
        });

        if (existingBranch) {
          throw new ConflictException("Branch name already exists");
        }

        const branch = await transaction.branch.create({
          data: { name, address, phone },
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            active: true,
            deliveryEnabled: true,
          },
        });

        await this.auditService.createAuditLog(
          {
            userId: currentUser.id,
            action: "CREATE",
            entity: "BRANCH",
            entityId: branch.id,
            newData: branch,
            reason: `Creación de la sede ${branch.name}`,
            ipAddress,
          },
          transaction,
        );

        return branch;
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2002"
      ) {
        throw new ConflictException("Branch name already exists");
      }

      throw error;
    }
  }

  async findSellableProducts(
    branchId: string,
    query: ListSellableProductsQueryDto,
    currentUser?: AuthenticatedUser,
  ) {
    const roleName = currentUser?.role?.name;
    if (
      (roleName === "BRANCH_LEADER" || roleName === "BRANCH_ASSISTANT") &&
      !(currentUser?.branches ?? []).some((branch) => branch.id === branchId)
    ) {
      throw new ForbiddenException({
        code: "BRANCH_SCOPE_VIOLATION",
        message: "You do not have access to this branch.",
      });
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException({
        code: "BRANCH_NOT_FOUND",
        message: "Branch not found",
      });
    }

    const { page, limit, search, categoryId } = query;

    const grouped = await this.prisma.branchInventory.groupBy({
      by: ["productId"],
      where: { branchId, expirationDate: { gte: startOfTodayUtc() } },
      _sum: { quantity: true },
    });
    const reserved = await reservedUnits(this.prisma, {
      productIds: grouped.map((g) => g.productId),
      branchIds: [branchId],
    });

    if (grouped.length === 0) {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const productIdsWithStock = grouped
      .filter((g) => (g._sum.quantity ?? 0) > 0)
      .map((g) => g.productId);

    if (productIdsWithStock.length === 0) {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const productWhere: Prisma.ProductWhereInput = {
      id: { in: productIdsWithStock },
      active: true,
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? { searchText: { contains: normalizeSearchTerm(search) } }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where: productWhere }),
      this.prisma.product.findMany({
        where: productWhere,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          referenceCode: true,
          price: true,
          unitOfMeasure: { select: { abreviation: true } },
          images: {
            select: {
              url: true,
              isPrimary: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: "asc" },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const quantityMap = new Map(
      grouped.map((g) => [g.productId, g._sum.quantity ?? 0]),
    );

    const data = products.map((product) => {
      const reservedQuantity =
        reserved.get(reservationKey(branchId, product.id)) ?? 0;
      return {
        productId: product.id,
        name: product.name,
        referenceCode: product.referenceCode,
        primaryImageUrl: this.getPrimaryImageUrl(product.images),
        price: product.price.toFixed(2),
        availableQuantity: Math.max(
          0,
          (quantityMap.get(product.id) ?? 0) - reservedQuantity,
        ),
        reservedQuantity,
        unit: product.unitOfMeasure.abreviation,
        category: product.category,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}
