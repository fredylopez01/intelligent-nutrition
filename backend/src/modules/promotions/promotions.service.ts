import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";
import { CreatePromotionDto } from "./dto/create-promotion.dto.js";
import { ListPromotionsQueryDto } from "./dto/list-promotions-query.dto.js";
import { UpdatePromotionDto } from "./dto/update-promotion.dto.js";

const promotionSelect = {
  id: true,
  name: true,
  discountPercentage: true,
  startDate: true,
  endDate: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PromotionSelect;

type PromotionRecord = Prisma.PromotionGetPayload<{
  select: typeof promotionSelect;
}>;

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function validatePromotionDates(startDate: Date | null, endDate: Date | null) {
  if (startDate && endDate && startDate > endDate) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "The promotion end date must be on or after its start date.",
      details: {},
    });
  }
}

function toPromotionResponse(promotion: PromotionRecord) {
  return {
    id: promotion.id,
    name: promotion.name,
    discountPercentage: promotion.discountPercentage.toFixed(2),
    startDate: promotion.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: promotion.endDate?.toISOString().slice(0, 10) ?? null,
    active: promotion.active,
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
  };
}

function promotionNotFound() {
  return new NotFoundException({
    code: "NOT_FOUND",
    message: "Promotion not found.",
    details: {},
  });
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === code
  );
}

function duplicatePromotionName() {
  return new ConflictException({
    code: "PROMOTION_NAME_ALREADY_EXISTS",
    message: "A promotion with this name already exists.",
    details: {},
  });
}

function promotionAlreadyActive() {
  return new ConflictException({
    code: "PROMOTION_ALREADY_ACTIVE",
    message: "Another promotion is already active.",
    details: {},
  });
}

function promotionIsActive() {
  return new UnprocessableEntityException({
    code: "PROMOTION_IS_ACTIVE",
    message: "Deactivate the promotion before editing it.",
    details: {},
  });
}

function promotionAlreadyInState() {
  return new ConflictException({
    code: "ALREADY_IN_STATE",
    message: "Promotion is already in the requested state.",
    details: {},
  });
}

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    createPromotionDto: CreatePromotionDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const startDate = createPromotionDto.startDate
      ? toDate(createPromotionDto.startDate)
      : null;
    const endDate = createPromotionDto.endDate
      ? toDate(createPromotionDto.endDate)
      : null;
    validatePromotionDates(startDate, endDate);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const promotion = await transaction.promotion.create({
          data: {
            createdById: currentUser.id,
            name: createPromotionDto.name,
            discountPercentage: new Prisma.Decimal(
              createPromotionDto.discountPercentage,
            ),
            startDate,
            endDate,
            active: false,
          },
          select: promotionSelect,
        });
        const response = toPromotionResponse(promotion);

        await this.auditService.createAuditLog(
          {
            userId: currentUser.id,
            action: "CREATE",
            entity: "PROMOTION",
            entityId: promotion.id,
            newData: response,
            reason: `Created promotion ${promotion.name}`,
            ipAddress,
          },
          transaction,
        );

        return response;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw duplicatePromotionName();
      }

      throw error;
    }
  }

  async findAll(query: ListPromotionsQueryDto) {
    const { page, limit, active, search, sortBy, sortOrder } = query;

    if (search !== undefined && search.length < 2) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Search must contain at least 2 characters.",
        details: { minLength: 2 },
      });
    }

    const where: Prisma.PromotionWhereInput = {
      ...(active === undefined ? {} : { active }),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const skip = (page - 1) * limit;
    const [total, promotions] = await this.prisma.$transaction([
      this.prisma.promotion.count({ where }),
      this.prisma.promotion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: promotionSelect,
      }),
    ]);

    return {
      data: promotions.map(toPromotionResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findActive() {
    const promotion = await this.prisma.promotion.findFirst({
      where: { active: true },
      select: promotionSelect,
    });

    return promotion ? toPromotionResponse(promotion) : null;
  }

  async findOne(promotionId: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
      select: promotionSelect,
    });

    if (!promotion) {
      throw promotionNotFound();
    }

    return toPromotionResponse(promotion);
  }

  async update(
    promotionId: string,
    updatePromotionDto: UpdatePromotionDto,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    if (Object.keys(updatePromotionDto).length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "At least one field must be provided.",
        details: {},
      });
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existingPromotion = await transaction.promotion.findUnique({
          where: { id: promotionId },
          select: {
            ...promotionSelect,
          },
        });

        if (!existingPromotion) {
          throw promotionNotFound();
        }
        if (existingPromotion.active) {
          throw promotionIsActive();
        }

        const startDate =
          updatePromotionDto.startDate === undefined
            ? existingPromotion.startDate
            : toDate(updatePromotionDto.startDate);
        const endDate =
          updatePromotionDto.endDate === undefined
            ? existingPromotion.endDate
            : toDate(updatePromotionDto.endDate);
        validatePromotionDates(startDate, endDate);

        const updatedPromotion = await transaction.promotion.update({
          where: { id: promotionId, active: false },
          data: {
            ...(updatePromotionDto.name === undefined
              ? {}
              : { name: updatePromotionDto.name }),
            ...(updatePromotionDto.discountPercentage === undefined
              ? {}
              : {
                  discountPercentage: new Prisma.Decimal(
                    updatePromotionDto.discountPercentage,
                  ),
                }),
            ...(updatePromotionDto.startDate === undefined
              ? {}
              : { startDate }),
            ...(updatePromotionDto.endDate === undefined ? {} : { endDate }),
          },
          select: promotionSelect,
        });
        const response = toPromotionResponse(updatedPromotion);

        await this.auditService.createAuditLog(
          {
            userId: currentUser.id,
            action: "UPDATE",
            entity: "PROMOTION",
            entityId: promotionId,
            oldData: toPromotionResponse(existingPromotion),
            newData: response,
            reason: `Updated promotion ${updatedPromotion.name}`,
            ipAddress,
          },
          transaction,
        );

        return response;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw duplicatePromotionName();
      }
      if (hasPrismaCode(error, "P2025")) {
        throw promotionIsActive();
      }

      throw error;
    }
  }

  async updateStatus(
    promotionId: string,
    active: boolean,
    currentUser: AuthenticatedUser,
    ipAddress?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const promotion = await transaction.promotion.findUnique({
          where: { id: promotionId },
          select: promotionSelect,
        });

        if (!promotion) {
          throw promotionNotFound();
        }
        if (promotion.active === active) {
          throw promotionAlreadyInState();
        }

        if (active) {
          const previousPromotions = await transaction.promotion.findMany({
            where: { active: true, id: { not: promotionId } },
            select: promotionSelect,
          });

          await transaction.promotion.updateMany({
            where: { active: true, id: { not: promotionId } },
            data: { active: false },
          });

          for (const previousPromotion of previousPromotions) {
            await this.auditService.createAuditLog(
              {
                userId: currentUser.id,
                action: "DEACTIVATE",
                entity: "PROMOTION",
                entityId: previousPromotion.id,
                oldData: toPromotionResponse(previousPromotion),
                newData: {
                  ...toPromotionResponse(previousPromotion),
                  active: false,
                },
                reason: `Replaced by promotion ${promotion.name}`,
                ipAddress,
              },
              transaction,
            );
          }
        }

        const updatedPromotion = await transaction.promotion.update({
          where: { id: promotionId, active: promotion.active },
          data: { active },
          select: promotionSelect,
        });

        await this.auditService.createAuditLog(
          {
            userId: currentUser.id,
            action: active ? "ACTIVATE" : "DEACTIVATE",
            entity: "PROMOTION",
            entityId: promotionId,
            oldData: toPromotionResponse(promotion),
            newData: toPromotionResponse(updatedPromotion),
            reason: `${active ? "Activated" : "Deactivated"} promotion ${promotion.name}`,
            ipAddress,
          },
          transaction,
        );

        return { message: "Promotion status updated successfully." };
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002") || hasPrismaCode(error, "P2034")) {
        throw promotionAlreadyActive();
      }
      if (hasPrismaCode(error, "P2025")) {
        throw promotionAlreadyInState();
      }

      throw error;
    }
  }
}
