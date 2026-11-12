import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
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
    jest.resetAllMocks();
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

  it("rejects a new promotion when its date range overlaps an existing one", async () => {
    promotionMock.findFirst.mockResolvedValue({ id: "existing-promotion-id" });

    await expect(
      service.create(
        {
          name: "Overlapping offer",
          discountPercentage: "20.00",
          startDate: "2026-03-31",
          endDate: "2026-04-30",
        },
        currentUser,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: "PROMOTION_DATE_RANGE_OVERLAP",
      }),
    });

    expect(promotionMock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { startDate: null },
                { startDate: { lte: new Date("2026-04-30T00:00:00.000Z") } },
              ],
            },
            {
              OR: [
                { endDate: null },
                { endDate: { gte: new Date("2026-03-31T00:00:00.000Z") } },
              ],
            },
          ],
        },
      }),
    );
    expect(promotionMock.create).not.toHaveBeenCalled();
  });

  it("rejects an edit when the updated range overlaps another promotion", async () => {
    promotionMock.findUnique.mockResolvedValue(buildPromotion());
    promotionMock.findFirst.mockResolvedValue({ id: "other-promotion-id" });

    await expect(
      service.update("promotion-id", { startDate: "2026-03-15" }, currentUser),
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({
        code: "PROMOTION_DATE_RANGE_OVERLAP",
      }),
    });

    expect(promotionMock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "promotion-id" },
        }),
      }),
    );
    expect(promotionMock.update).not.toHaveBeenCalled();
  });

  it("returns the active promotion whose date range includes today", async () => {
    const promotion = buildPromotion({ active: true });
    promotionMock.findFirst.mockResolvedValue(promotion);

    const result = await service.findActive();

    expect(promotionMock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          AND: [
            {
              OR: [
                { startDate: null },
                { startDate: { lte: expect.any(Date) } },
              ],
            },
            {
              OR: [{ endDate: null }, { endDate: { gte: expect.any(Date) } }],
            },
          ],
        },
      }),
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

  describe("create with dates", () => {
    it("stores the range as UTC dates and returns it as YYYY-MM-DD", async () => {
      promotionMock.findFirst.mockResolvedValue(null);
      promotionMock.create.mockResolvedValue(buildPromotion());

      const result = await service.create(
        {
          name: "Spring offer",
          discountPercentage: "15.00",
          startDate: "2026-03-01",
          endDate: "2026-03-31",
        },
        currentUser,
      );

      expect(promotionMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startDate: new Date("2026-03-01T00:00:00.000Z"),
            endDate: new Date("2026-03-31T00:00:00.000Z"),
          }),
        }),
      );
      expect(result).toMatchObject({
        startDate: "2026-03-01",
        endDate: "2026-03-31",
      });
    });

    it("checks the overlap without date conditions when the promotion has no dates", async () => {
      promotionMock.findFirst.mockResolvedValue(null);
      promotionMock.create.mockResolvedValue(
        buildPromotion({ startDate: null, endDate: null }),
      );

      await service.create(
        { name: "Always on", discountPercentage: "5.00" },
        currentUser,
      );

      expect(promotionMock.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [] } }),
      );
    });

    it("maps a duplicate name to PROMOTION_NAME_ALREADY_EXISTS", async () => {
      promotionMock.findFirst.mockResolvedValue(null);
      promotionMock.create.mockRejectedValue({ code: "P2002" });

      await expect(
        service.create(
          { name: "Duplicated offer", discountPercentage: "10.00" },
          currentUser,
        ),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: "PROMOTION_NAME_ALREADY_EXISTS",
        }),
      });
    });
  });

  describe("findAll validation", () => {
    it("rejects a search shorter than two characters", async () => {
      await expect(
        service.findAll({
          page: 1,
          limit: 10,
          search: "p",
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      ).rejects.toMatchObject({
        status: 400,
        response: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
      expect(promotionMock.count).not.toHaveBeenCalled();
    });

    it("does not filter when no query filters are provided", async () => {
      promotionMock.count.mockResolvedValue(0);
      promotionMock.findMany.mockResolvedValue([]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(promotionMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result.meta).toMatchObject({ total: 0, totalPages: 0 });
    });
  });

  describe("findActive date window", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("compares the range against today at 00:00 UTC", async () => {
      jest.useFakeTimers({ now: new Date("2026-03-15T18:45:00.000Z") });
      promotionMock.findFirst.mockResolvedValue(null);
      const today = new Date("2026-03-15T00:00:00.000Z");

      await service.findActive();

      expect(promotionMock.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            active: true,
            AND: [
              { OR: [{ startDate: null }, { startDate: { lte: today } }] },
              { OR: [{ endDate: null }, { endDate: { gte: today } }] },
            ],
          },
        }),
      );
    });
  });

  describe("findApplicable", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("lists the promotions valid today with the active one first", async () => {
      jest.useFakeTimers({ now: new Date("2026-03-15T18:45:00.000Z") });
      const today = new Date("2026-03-15T00:00:00.000Z");
      promotionMock.findMany.mockResolvedValue([
        buildPromotion({ active: true }),
        buildPromotion({ id: "other-id", name: "Weekend", startDate: null }),
      ]);

      const result = await service.findApplicable();

      expect(promotionMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { OR: [{ startDate: null }, { startDate: { lte: today } }] },
              { OR: [{ endDate: null }, { endDate: { gte: today } }] },
            ],
          },
          orderBy: [{ active: "desc" }, { name: "asc" }],
        }),
      );
      expect(result).toEqual([
        expect.objectContaining({ id: "promotion-id", active: true }),
        expect.objectContaining({ id: "other-id", startDate: null }),
      ]);
    });
  });

  describe("findApplicableById", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns a promotion valid today even when it is not active", async () => {
      jest.useFakeTimers({ now: new Date("2026-03-15T18:45:00.000Z") });
      promotionMock.findUnique.mockResolvedValue(buildPromotion());

      await expect(
        service.findApplicableById("promotion-id"),
      ).resolves.toMatchObject({
        id: "promotion-id",
        active: false,
        discountPercentage: "15.00",
      });
    });

    it("accepts the first and last day of the period", async () => {
      promotionMock.findUnique.mockResolvedValue(buildPromotion());

      jest.useFakeTimers({ now: new Date("2026-03-01T05:00:00.000Z") });
      await expect(
        service.findApplicableById("promotion-id"),
      ).resolves.toBeDefined();
      jest.useFakeTimers({ now: new Date("2026-03-31T23:00:00.000Z") });
      await expect(
        service.findApplicableById("promotion-id"),
      ).resolves.toBeDefined();
    });

    it("rejects a promotion outside its dates", async () => {
      jest.useFakeTimers({ now: new Date("2026-04-01T12:00:00.000Z") });
      promotionMock.findUnique.mockResolvedValue(buildPromotion());

      await expect(
        service.findApplicableById("promotion-id"),
      ).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({ code: "PROMOTION_NOT_APPLICABLE" }),
      });
    });

    it("throws NOT_FOUND when the promotion does not exist", async () => {
      promotionMock.findUnique.mockResolvedValue(null);

      await expect(
        service.findApplicableById("missing-id"),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({ code: "NOT_FOUND" }),
      });
    });
  });

  describe("findOne", () => {
    it("returns the promotion with a two-decimal discount", async () => {
      promotionMock.findUnique.mockResolvedValue(buildPromotion());

      await expect(service.findOne("promotion-id")).resolves.toMatchObject({
        id: "promotion-id",
        discountPercentage: "15.00",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
      });
    });

    it("throws NOT_FOUND when the promotion does not exist", async () => {
      promotionMock.findUnique.mockResolvedValue(null);

      await expect(service.findOne("missing-id")).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({ code: "NOT_FOUND" }),
      });
    });
  });

  describe("update edge cases", () => {
    it("keeps the stored dates when only the name changes and audits both versions", async () => {
      promotionMock.findUnique.mockResolvedValue(buildPromotion());
      promotionMock.findFirst.mockResolvedValue(null);
      promotionMock.update.mockResolvedValue(
        buildPromotion({ name: "Renamed offer" }),
      );

      await service.update(
        "promotion-id",
        { name: "Renamed offer" },
        currentUser,
      );

      expect(promotionMock.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: "Renamed offer" } }),
      );
      expect(auditMock.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE",
          oldData: expect.objectContaining({ name: "Spring offer" }),
          newData: expect.objectContaining({ name: "Renamed offer" }),
        }),
        transactionMock,
      );
    });

    it("updates the discount and the date range explicitly", async () => {
      promotionMock.findUnique.mockResolvedValue(buildPromotion());
      promotionMock.findFirst.mockResolvedValue(null);
      promotionMock.update.mockResolvedValue(
        buildPromotion({
          discountPercentage: new Prisma.Decimal("20.00"),
          startDate: new Date("2026-04-01T00:00:00.000Z"),
          endDate: new Date("2026-04-30T00:00:00.000Z"),
        }),
      );

      const result = await service.update(
        "promotion-id",
        {
          discountPercentage: "20.00",
          startDate: "2026-04-01",
          endDate: "2026-04-30",
        },
        currentUser,
      );

      expect(promotionMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            discountPercentage: new Prisma.Decimal("20.00"),
            startDate: new Date("2026-04-01T00:00:00.000Z"),
            endDate: new Date("2026-04-30T00:00:00.000Z"),
          },
        }),
      );
      expect(result).toMatchObject({
        discountPercentage: "20.00",
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      });
    });

    it("throws NOT_FOUND when the promotion does not exist", async () => {
      promotionMock.findUnique.mockResolvedValue(null);

      await expect(
        service.update("missing-id", { name: "Updated" }, currentUser),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({ code: "NOT_FOUND" }),
      });
    });

    it("maps a duplicate name to PROMOTION_NAME_ALREADY_EXISTS", async () => {
      promotionMock.findUnique.mockResolvedValue(buildPromotion());
      promotionMock.findFirst.mockResolvedValue(null);
      promotionMock.update.mockRejectedValue({ code: "P2002" });

      await expect(
        service.update("promotion-id", { name: "Duplicated" }, currentUser),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: "PROMOTION_NAME_ALREADY_EXISTS",
        }),
      });
    });

    it("maps a missing row on update to PROMOTION_IS_ACTIVE", async () => {
      promotionMock.findUnique.mockResolvedValue(buildPromotion());
      promotionMock.findFirst.mockResolvedValue(null);
      promotionMock.update.mockRejectedValue({ code: "P2025" });

      await expect(
        service.update("promotion-id", { name: "Updated" }, currentUser),
      ).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({ code: "PROMOTION_IS_ACTIVE" }),
      });
    });

    it("rejects a start date after the stored end date", async () => {
      promotionMock.findUnique.mockResolvedValue(buildPromotion());

      await expect(
        service.update(
          "promotion-id",
          { startDate: "2026-04-15" },
          currentUser,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(promotionMock.findFirst).not.toHaveBeenCalled();
      expect(promotionMock.update).not.toHaveBeenCalled();
    });
  });

  describe("updateStatus edge cases", () => {
    it("deactivates an active promotion with a single audit entry", async () => {
      promotionMock.findUnique.mockResolvedValue(
        buildPromotion({ active: true }),
      );
      promotionMock.update.mockResolvedValue(buildPromotion({ active: false }));

      await expect(
        service.updateStatus("promotion-id", false, currentUser),
      ).resolves.toEqual({ message: "Promotion status updated successfully." });

      expect(promotionMock.updateMany).not.toHaveBeenCalled();
      expect(promotionMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "promotion-id", active: true },
          data: { active: false },
        }),
      );
      expect(auditMock.createAuditLog).toHaveBeenCalledTimes(1);
    });

    it("rejects a status change to the current state", async () => {
      promotionMock.findUnique.mockResolvedValue(
        buildPromotion({ active: true }),
      );

      await expect(
        service.updateStatus("promotion-id", true, currentUser),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: "ALREADY_IN_STATE" }),
      });
    });

    it("throws NOT_FOUND when the promotion does not exist", async () => {
      promotionMock.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus("missing-id", true, currentUser),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({ code: "NOT_FOUND" }),
      });
    });

    it("maps a write conflict while activating to PROMOTION_ALREADY_ACTIVE", async () => {
      promotionMock.findUnique.mockResolvedValue(buildPromotion());
      promotionMock.findMany.mockResolvedValue([]);
      promotionMock.updateMany.mockResolvedValue({ count: 0 });
      promotionMock.update.mockRejectedValue({ code: "P2034" });

      await expect(
        service.updateStatus("promotion-id", true, currentUser),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          code: "PROMOTION_ALREADY_ACTIVE",
        }),
      });
    });

    it("maps a missing row while activating to ALREADY_IN_STATE", async () => {
      promotionMock.findUnique.mockResolvedValue(buildPromotion());
      promotionMock.findMany.mockResolvedValue([]);
      promotionMock.updateMany.mockResolvedValue({ count: 0 });
      promotionMock.update.mockRejectedValue({ code: "P2025" });

      await expect(
        service.updateStatus("promotion-id", true, currentUser),
      ).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ code: "ALREADY_IN_STATE" }),
      });
    });
  });
});
