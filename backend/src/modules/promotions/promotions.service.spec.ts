import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Test } from "@nestjs/testing";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../../database/prisma/prisma.service.js";
import { PromotionsService } from "./promotions.service.js";

type MockAsync = (...args: unknown[]) => Promise<unknown>;

const promotionMock = {
  count: jest.fn<MockAsync>(),
  create: jest.fn<MockAsync>(),
  findFirst: jest.fn<MockAsync>(),
  findMany: jest.fn<MockAsync>(),
  findUnique: jest.fn<MockAsync>(),
  update: jest.fn<MockAsync>(),
  updateMany: jest.fn<MockAsync>(),
};

const transactionMock = { promotion: promotionMock };
const auditMock = {
  createAuditLog: jest.fn<MockAsync>(),
};

type TransactionCallback = (
  transaction: typeof transactionMock,
) => Promise<unknown>;

async function executeTransaction(operation: unknown): Promise<unknown> {
  if (typeof operation === "function") {
    return (operation as TransactionCallback)(transactionMock);
  }
  if (Array.isArray(operation)) {
    return Promise.all(operation as Promise<unknown>[]);
  }

  throw new Error("Unsupported transaction operation.");
}

const prismaMock = {
  promotion: promotionMock,
  $transaction: jest.fn(executeTransaction),
};

const currentUser: AuthenticatedUser = {
  id: "superadmin-id",
  active: true,
  role: { name: "SUPERADMIN" },
};

function buildPromotion(overrides: Record<string, unknown> = {}) {
  return {
    id: "promotion-id",
    name: "Spring offer",
    discountPercentage: new Prisma.Decimal("15.00"),
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    endDate: new Date("2026-03-31T00:00:00.000Z"),
    active: false,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("PromotionsService", () => {
  let service: PromotionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(executeTransaction);

    const module = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get(PromotionsService);
  });

  it("creates inactive promotions with optional dates and audits the change", async () => {
    promotionMock.create.mockResolvedValue(
      buildPromotion({ startDate: null, endDate: null }),
    );
    auditMock.createAuditLog.mockResolvedValue({});

    const result = await service.create(
      {
        name: "Spring offer",
        discountPercentage: "15.00",
      },
      currentUser,
      "127.0.0.1",
    );

    expect(promotionMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: "superadmin-id",
          discountPercentage: new Prisma.Decimal("15.00"),
          startDate: null,
          endDate: null,
          active: false,
        }),
      }),
    );
    expect(result).toMatchObject({
      discountPercentage: "15.00",
      startDate: null,
      endDate: null,
      active: false,
    });
    expect(auditMock.createAuditLog).toHaveBeenCalledTimes(1);
  });

  it("rejects a promotion whose end date precedes its start date", async () => {
    await expect(
      service.create(
        {
          name: "Invalid offer",
          discountPercentage: "15.00",
          startDate: "2026-03-31",
          endDate: "2026-03-01",
        },
        currentUser,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(promotionMock.create).not.toHaveBeenCalled();
  });

  it("returns the active promotion without date filtering", async () => {
    const promotion = buildPromotion({ active: true });
    promotionMock.findFirst.mockResolvedValue(promotion);

    const result = await service.findActive();

    expect(promotionMock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
    expect(result).toMatchObject({ id: "promotion-id", active: true });
  });

  it("returns null when no promotion is active", async () => {
    promotionMock.findFirst.mockResolvedValue(null);

    await expect(service.findActive()).resolves.toBeNull();
  });

  it("returns a paginated, filtered list", async () => {
    promotionMock.count.mockResolvedValue(1);
    promotionMock.findMany.mockResolvedValue([buildPromotion()]);

    const result = await service.findAll({
      page: 2,
      limit: 10,
      active: false,
      search: "Spring",
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(promotionMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          active: false,
          name: { contains: "Spring", mode: "insensitive" },
        }),
      }),
    );
    expect(result).toMatchObject({
      data: [{ discountPercentage: "15.00" }],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it("rejects an empty update", async () => {
    await expect(
      service.update("promotion-id", {}, currentUser),
    ).rejects.toMatchObject({ status: 400 });
    expect(promotionMock.update).not.toHaveBeenCalled();
  });

  it("prevents editing active promotions", async () => {
    promotionMock.findUnique.mockResolvedValue(
      buildPromotion({ active: true }),
    );

    await expect(
      service.update("promotion-id", { name: "Updated offer" }, currentUser),
    ).rejects.toMatchObject({
      status: 422,
      response: expect.objectContaining({ code: "PROMOTION_IS_ACTIVE" }),
    });
    expect(promotionMock.update).not.toHaveBeenCalled();
  });

  it("deactivates the current promotion before activating another", async () => {
    promotionMock.findUnique.mockResolvedValue(buildPromotion());
    promotionMock.findMany.mockResolvedValue([
      buildPromotion({ id: "previous-id", active: true }),
    ]);
    promotionMock.updateMany.mockResolvedValue({ count: 1 });
    promotionMock.update.mockResolvedValue(buildPromotion({ active: true }));
    auditMock.createAuditLog.mockResolvedValue({});

    await expect(
      service.updateStatus("promotion-id", true, currentUser),
    ).resolves.toEqual({ message: "Promotion status updated successfully." });

    expect(promotionMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, id: { not: "promotion-id" } },
        data: { active: false },
      }),
    );
    expect(promotionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "promotion-id", active: false },
        data: { active: true },
      }),
    );
    expect(auditMock.createAuditLog).toHaveBeenCalledTimes(2);
  });
});
