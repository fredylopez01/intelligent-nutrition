import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const prismaMock = {
  branch: {
    findUnique: jest.fn<AsyncMock>(),
    findMany: jest.fn<AsyncMock>(),
  },
  sale: {
    aggregate: jest.fn<AsyncMock>(),
    findMany: jest.fn<AsyncMock>(),
  },
  saleDetail: {
    groupBy: jest.fn<AsyncMock>(),
  },
  branchInventory: {
    findMany: jest.fn<AsyncMock>(),
  },
  cashShift: {
    findMany: jest.fn<AsyncMock>(),
  },
  product: {
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

const centro = { id: "branch-centro", name: "Centro" };
const norte = { id: "branch-norte", name: "Norte" };
const protein = { id: "category-protein", name: "Proteína" };
const creatine = { id: "category-creatine", name: "Creatina" };

function lot(
  branchId: string,
  productId: string,
  quantity: number,
  values: Partial<{
    minimumStock: number;
    expirationDate: string;
    category: { id: string; name: string };
    name: string;
  }> = {},
) {
  return {
    branchId,
    productId,
    quantity,
    minimumStock: values.minimumStock ?? 0,
    expirationDate: new Date(
      `${values.expirationDate ?? "2028-01-01"}T00:00:00.000Z`,
    ),
    product: {
      name: values.name ?? productId,
      referenceCode: productId.toUpperCase(),
      category: values.category ?? protein,
    },
  };
}

function sale(
  branchId: string,
  at: string,
  total: string,
  customerId?: string,
) {
  return {
    branchId,
    customerId: customerId ?? null,
    saleAt: new Date(at),
    total,
  };
}

describe("DashboardService", () => {
  let service: InstanceType<typeof DashboardService>;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-11-12T20:00:00.000Z") });
    jest.resetAllMocks();
    prismaMock.branch.findUnique.mockResolvedValue(centro);
    prismaMock.branch.findMany.mockResolvedValue([centro, norte]);
    prismaMock.sale.findMany.mockResolvedValue([
      sale(centro.id, "2026-11-12T15:00:00.000Z", "100000.00", "customer-1"),
      sale(centro.id, "2026-11-12T19:00:00.000Z", "50000.00", "customer-1"),
      sale(norte.id, "2026-11-12T16:00:00.000Z", "200000.00", "customer-2"),
      sale(centro.id, "2026-11-11T14:00:00.000Z", "80000.00"),
      sale(centro.id, "2026-11-11T23:00:00.000Z", "999000.00"),
      sale(norte.id, "2026-11-07T15:00:00.000Z", "40000.00"),
    ]);
    prismaMock.sale.aggregate.mockResolvedValue({
      _sum: { total: "1500000.00" },
    });
    prismaMock.saleDetail.groupBy.mockResolvedValue([
      { productId: "whey", _sum: { quantity: 2, total: "300000.00" } },
      { productId: "creatine", _sum: { quantity: 5, total: "250000.00" } },
    ]);
    prismaMock.product.findMany.mockResolvedValue([
      { id: "whey", name: "Whey 2 lb", referenceCode: "WHEY" },
      { id: "creatine", name: "Creatina 300 g", referenceCode: "CREA" },
    ]);
    prismaMock.branchInventory.findMany.mockResolvedValue([
      lot(centro.id, "whey", 0, { name: "Whey 2 lb" }),
      lot(norte.id, "whey", 20, { name: "Whey 2 lb" }),
      lot(centro.id, "creatine", 1, { category: creatine, name: "Creatina" }),
      lot(centro.id, "bcaa", 3, { minimumStock: 10, name: "BCAA" }),
      lot(centro.id, "bcaa", 2, { minimumStock: 10, name: "BCAA" }),
      lot(norte.id, "omega", 8, {
        expirationDate: "2026-12-27",
        name: "Omega 3",
        category: creatine,
      }),
      lot(norte.id, "vitamin", 30, { name: "Vitamina C" }),
    ]);
    prismaMock.cashShift.findMany.mockResolvedValue([{ branchId: centro.id }]);

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("summarizes the sales of the day, yesterday until now and the last 7 days", async () => {
    const result = await service.getGlobalDashboard();

    expect(result.date).toBe("2026-11-12");
    expect(result.salesToday).toEqual({ count: 3, totalAmount: 350000 });
    expect(result.salesYesterdayUntilNow).toBe(80000);
    expect(result.uniqueCustomersToday).toBe(2);
    expect(result.monthlyRevenue).toBe(1500000);
    expect(result.salesLast7Days).toEqual([
      { date: "2026-11-06", totalAmount: 0 },
      { date: "2026-11-07", totalAmount: 40000 },
      { date: "2026-11-08", totalAmount: 0 },
      { date: "2026-11-09", totalAmount: 0 },
      { date: "2026-11-10", totalAmount: 0 },
      { date: "2026-11-11", totalAmount: 1079000 },
      { date: "2026-11-12", totalAmount: 350000 },
    ]);
  });

  it("reports the branches with an open cash shift and their sales", async () => {
    const result = await service.getGlobalDashboard();

    expect(result.branches).toEqual({
      active: 2,
      open: 1,
      items: [
        { branchId: centro.id, name: "Centro", open: true, salesToday: 150000 },
        { branchId: norte.id, name: "Norte", open: false, salesToday: 200000 },
      ],
    });
    expect(result.topBranch).toEqual({
      branchId: norte.id,
      name: "Norte",
      total: "200000.00",
    });
    expect(result.totalSalesToday).toBe("350000.00");
    expect(result.totalSalesCount).toBe(3);
    expect(result.branchesActive).toBe(2);
  });

  it("totals the stock and the top categories", async () => {
    const result = await service.getGlobalDashboard();

    expect(result.stock).toEqual({
      totalUnits: 64,
      byCategory: [
        { categoryId: protein.id, name: "Proteína", units: 55 },
        { categoryId: creatine.id, name: "Creatina", units: 9 },
      ],
    });
    expect(result.criticalStockProducts).toBe(1);
  });

  it("lists the inventory alerts by severity", async () => {
    const result = await service.getGlobalDashboard();

    expect(result.alerts.total).toBe(4);
    expect(result.alerts.lowStockProducts).toBe(1);
    expect(result.lowStockAlerts).toBe(1);
    expect(result.alerts.items).toEqual([
      {
        type: "OUT_OF_STOCK",
        productId: "whey",
        productName: "Whey 2 lb",
        referenceCode: "WHEY",
        quantity: 0,
        branches: [{ id: centro.id, name: "Centro" }],
        expirationDate: null,
      },
      expect.objectContaining({
        type: "LAST_UNIT",
        productId: "creatine",
        quantity: 1,
      }),
      expect.objectContaining({
        type: "BELOW_MINIMUM",
        productId: "bcaa",
        quantity: 5,
        branches: [{ id: centro.id, name: "Centro" }],
      }),
      expect.objectContaining({
        type: "EXPIRING",
        productId: "omega",
        quantity: 8,
        expirationDate: "2026-12-27",
        branches: [{ id: norte.id, name: "Norte" }],
      }),
    ]);
  });

  it("ranks the products sold today by units", async () => {
    const result = await service.getGlobalDashboard();

    expect(result.topProducts).toEqual([
      {
        productId: "creatine",
        name: "Creatina 300 g",
        referenceCode: "CREA",
        quantity: 5,
        total: 250000,
      },
      {
        productId: "whey",
        name: "Whey 2 lb",
        referenceCode: "WHEY",
        quantity: 2,
        total: 300000,
      },
    ]);
  });

  it("only reads the active branches for the global dashboard", async () => {
    await service.getGlobalDashboard();

    expect(prismaMock.branch.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: { in: [centro.id, norte.id] },
          status: "COMPLETED",
        }),
      }),
    );
  });

  it("limits the branch dashboard to the requested branch", async () => {
    const result = await service.getBranchDashboard(centro.id);

    expect(result.branch).toEqual(centro);
    expect(prismaMock.branchInventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: { in: [centro.id] }, product: { active: true } },
      }),
    );
    expect(result.branches.active).toBe(1);
  });

  it("returns no top products when nothing was sold today", async () => {
    prismaMock.saleDetail.groupBy.mockResolvedValue([]);

    const result = await service.getBranchDashboard(centro.id);

    expect(result.topProducts).toEqual([]);
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();
  });

  it("throws BRANCH_NOT_FOUND when the branch does not exist", async () => {
    prismaMock.branch.findUnique.mockResolvedValue(null);

    await expect(service.getBranchDashboard("missing")).rejects.toThrow(
      NotFoundException,
    );
  });
});
