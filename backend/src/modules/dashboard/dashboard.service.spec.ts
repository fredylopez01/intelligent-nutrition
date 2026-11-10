import { jest, describe, beforeEach, it, expect } from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const prismaMock = {
  branch: {
    findUnique: jest.fn<AsyncMock>(),
  },
  sale: {
    aggregate: jest.fn<AsyncMock>(),
    findMany: jest.fn<AsyncMock>(),
  },
  branchInventory: {
    findMany: jest.fn<AsyncMock>(),
  },
};

jest.unstable_mockModule("../../database/prisma/prisma.service.js", () => ({
  PrismaService: jest.fn().mockImplementation(() => prismaMock),
}));

const { Test } = await import("@nestjs/testing");
const { NotFoundException } = await import("@nestjs/common");
const { DashboardService } = await import("./dashboard.service.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");

describe("DashboardService", () => {
  let service: InstanceType<typeof DashboardService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.branch.findUnique.mockResolvedValue({ id: "branch-id" });
    prismaMock.sale.aggregate
      .mockResolvedValueOnce({
        _count: { _all: 3 },
        _sum: { total: "125.50" },
      })
      .mockResolvedValueOnce({ _sum: { total: "900.75" } });
    prismaMock.sale.findMany.mockResolvedValue([
      { customerId: "customer-1" },
      { customerId: "customer-2" },
    ]);
    prismaMock.branchInventory.findMany.mockResolvedValue([
      { productId: "product-low-lots", quantity: 2 },
      { productId: "product-low-lots", quantity: 2 },
      { productId: "product-exact-limit", quantity: 5 },
      { productId: "product-healthy", quantity: 8 },
      { productId: "product-out", quantity: 0 },
    ]);

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  it("returns accurate dashboard indicators for the requested branch", async () => {
    const result = await service.getBranchDashboard("branch-id");

    expect(result).toEqual({
      salesToday: { count: 3, totalAmount: 125.5 },
      uniqueCustomersToday: 2,
      criticalStockProducts: 2,
      monthlyRevenue: 900.75,
    });
    expect(prismaMock.sale.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: "branch-id",
          status: "COMPLETED",
        }),
        _count: { _all: true },
        _sum: { total: true },
      }),
    );
    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ["customerId"],
        select: { customerId: true },
      }),
    );
    expect(prismaMock.branchInventory.findMany).toHaveBeenCalledWith({
      where: { branchId: "branch-id" },
      select: { productId: true, quantity: true },
    });
  });

  it("returns 404 for a branch that does not exist", async () => {
    prismaMock.branch.findUnique.mockResolvedValue(null);

    await expect(service.getBranchDashboard("missing-branch")).rejects.toThrow(
      NotFoundException,
    );

    expect(prismaMock.sale.aggregate).not.toHaveBeenCalled();
    expect(prismaMock.sale.findMany).not.toHaveBeenCalled();
    expect(prismaMock.branchInventory.findMany).not.toHaveBeenCalled();
  });

  it("returns zeroed indicators for a branch without sales or inventory", async () => {
    prismaMock.sale.aggregate.mockReset();
    prismaMock.sale.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { total: null },
    });
    prismaMock.sale.findMany.mockResolvedValue([]);
    prismaMock.branchInventory.findMany.mockResolvedValue([]);

    await expect(service.getBranchDashboard("branch-id")).resolves.toEqual({
      salesToday: { count: 0, totalAmount: 0 },
      uniqueCustomersToday: 0,
      criticalStockProducts: 0,
      monthlyRevenue: 0,
    });
  });

  it("filters today's sales with the Bogota day boundaries", async () => {
    jest.useFakeTimers({ now: new Date("2026-11-10T15:00:00.000Z") });

    try {
      await service.getBranchDashboard("branch-id");
    } finally {
      jest.useRealTimers();
    }

    expect(prismaMock.sale.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          saleAt: {
            gte: new Date("2026-11-10T05:00:00.000Z"),
            lt: new Date("2026-11-11T05:00:00.000Z"),
          },
        }),
      }),
    );
  });

  it("filters the monthly revenue from the first day of the business month", async () => {
    jest.useFakeTimers({ now: new Date("2026-11-10T15:00:00.000Z") });

    try {
      await service.getBranchDashboard("branch-id");
    } finally {
      jest.useRealTimers();
    }

    expect(prismaMock.sale.aggregate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: "branch-id",
          status: "COMPLETED",
          saleAt: {
            gte: new Date("2026-11-01T05:00:00.000Z"),
            lte: new Date("2026-11-10T15:00:00.000Z"),
          },
        }),
      }),
    );
  });

  it("scopes every query to the requested branch and ignores anonymous customers", async () => {
    await service.getBranchDashboard("branch-other");

    expect(prismaMock.branch.findUnique).toHaveBeenCalledWith({
      where: { id: "branch-other" },
      select: { id: true },
    });
    expect(prismaMock.sale.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ branchId: "branch-other" }),
      }),
    );
    expect(prismaMock.sale.aggregate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ branchId: "branch-other" }),
      }),
    );
    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: "branch-other",
          customerId: { not: null },
        }),
      }),
    );
    expect(prismaMock.branchInventory.findMany).toHaveBeenCalledWith({
      where: { branchId: "branch-other" },
      select: { productId: true, quantity: true },
    });
  });

  it("groups the stock by product before applying the critical threshold", async () => {
    prismaMock.branchInventory.findMany.mockResolvedValue([
      { productId: "fits-above", quantity: 3 },
      { productId: "fits-above", quantity: 3 },
      { productId: "exactly-limit", quantity: 4 },
      { productId: "exactly-limit", quantity: 1 },
      { productId: "below", quantity: 4 },
      { productId: "empty", quantity: 0 },
    ]);

    await expect(service.getBranchDashboard("branch-id")).resolves.toMatchObject(
      {
        criticalStockProducts: 2,
      },
    );
  });
});
