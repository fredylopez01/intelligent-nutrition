import { jest, describe, beforeEach, it, expect } from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type SyncMock = (...args: unknown[]) => unknown;

const prismaMock = {
  supply: {
    findUnique: jest.fn<AsyncMock>(),
  },
  branch: {
    findUnique: jest.fn<AsyncMock>(),
  },
  supplyStock: {
    findUnique: jest.fn<AsyncMock>(),
    upsert: jest.fn<AsyncMock>(),
    updateMany: jest.fn<AsyncMock>(),
  },
  supplyStockMovement: {
    create: jest.fn<AsyncMock>(),
  },
  $queryRaw: jest.fn<AsyncMock>(),
  $transaction: jest.fn<SyncMock>(),
};

const auditMock = {
  createAuditLog: jest.fn<AsyncMock>(),
};

jest.unstable_mockModule("../../database/prisma/prisma.service.js", () => ({
  PrismaService: jest.fn().mockImplementation(() => prismaMock),
}));

jest.unstable_mockModule("../audit/audit.service.js", () => ({
  AuditService: jest.fn().mockImplementation(() => auditMock),
}));

const { Test } = await import("@nestjs/testing");
const { ForbiddenException, NotFoundException, UnprocessableEntityException } =
  await import("@nestjs/common");
const { Prisma } = await import("../../../generated/prisma/client.js");
const { SupplyStockService, toSupplyStockResponse } =
  await import("./supply-stock.service.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");
const { AuditService } = await import("../audit/audit.service.js");
const { LowStockService } =
  await import("../notifications/low-stock.service.js");

const lowStockMock = {
  levels: () => Promise.resolve(new Map()),
  notifyCrossings: () => Promise.resolve(0),
};

const superadmin = {
  id: "user-1",
  active: true,
  role: { name: "SUPERADMIN" },
  branches: [],
};

const branchLeader = {
  id: "user-2",
  active: true,
  role: { name: "BRANCH_LEADER" },
  branches: [{ id: "branch-1", name: "Sede Centro" }],
};

const stockRow = {
  supplyId: "supply-1",
  supplyName: "Whey Protein",
  unitId: "unit-g",
  unitAbbreviation: "g",
  branchId: "branch-1",
  branchName: "Sede Centro",
  quantity: "5.000",
  minimumQuantity: "10.000",
  updatedAt: new Date("2026-11-12T10:00:00.000Z"),
  sourceProductId: "product-whey",
  sourceProductName: "Whey 2 lb",
  productUnitQuantity: "907.000",
};

async function buildService() {
  const module = await Test.createTestingModule({
    providers: [
      SupplyStockService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: AuditService, useValue: auditMock },
      { provide: LowStockService, useValue: lowStockMock },
    ],
  }).compile();
  return module.get(SupplyStockService);
}

function mockValidSupplyAndBranch() {
  prismaMock.supply.findUnique.mockResolvedValueOnce({
    name: "Whey Protein",
    active: true,
  });
  prismaMock.branch.findUnique.mockResolvedValueOnce({ active: true });
}

describe("toSupplyStockResponse", () => {
  it("returns the contract shape and computes the low stock flag", () => {
    expect(toSupplyStockResponse(stockRow)).toEqual({
      supplyId: "supply-1",
      supply: {
        name: "Whey Protein",
        unitOfMeasure: { id: "unit-g", abbreviation: "g" },
      },
      branchId: "branch-1",
      branchName: "Sede Centro",
      quantity: "5.000",
      minimumQuantity: "10.000",
      lowStock: true,
      updatedAt: stockRow.updatedAt,
      sourceProduct: {
        id: "product-whey",
        name: "Whey 2 lb",
        unitQuantity: 907,
      },
    });
    expect(
      toSupplyStockResponse({ ...stockRow, quantity: "10.000" }).lowStock,
    ).toBe(false);
    expect(
      toSupplyStockResponse({
        ...stockRow,
        sourceProductId: null,
        sourceProductName: null,
        productUnitQuantity: null,
      }).sourceProduct,
    ).toBeNull();
  });
});

describe("SupplyStockService.findAll", () => {
  let service: InstanceType<typeof SupplyStockService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    service = await buildService();
  });

  it("returns a page of stocks for the superadmin without branchId", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ total: 21n }])
      .mockResolvedValueOnce([stockRow]);

    const result = await service.findAll({ page: 2, limit: 20 }, superadmin);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].lowStock).toBe(true);
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
    });
  });

  it("forbids non-superadmin without branchId", async () => {
    await expect(
      service.findAll({ page: 1, limit: 20 }, branchLeader),
    ).rejects.toThrow(ForbiddenException);
  });

  it("forbids branch leader requesting another branch", async () => {
    await expect(
      service.findAll(
        { branchId: "branch-other", page: 1, limit: 20 },
        branchLeader,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows branch leader on their assigned branch", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    const result = await service.findAll(
      { branchId: "branch-1", page: 1, limit: 20 },
      branchLeader,
    );

    expect(result.data).toHaveLength(0);
    expect(result.meta.totalPages).toBe(0);
  });
});

describe("SupplyStockService.createMovement", () => {
  let service: InstanceType<typeof SupplyStockService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    );
    service = await buildService();
  });

  const movementRow = {
    id: "mv-1",
    movementType: "ENTRY",
    quantity: new Prisma.Decimal(10),
    observation: null,
    movementAt: new Date(),
    supply: { id: "supply-1", name: "Whey" },
    branch: { id: "branch-1", name: "Sede Centro" },
    user: {
      personId: "user-2",
      person: { firstName: "Ana", lastName: "López" },
    },
  };

  it("throws NotFoundException when the supply does not exist", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce(null);
    prismaMock.branch.findUnique.mockResolvedValueOnce({ active: true });

    await expect(
      service.createMovement(
        {
          branchId: "branch-1",
          supplyId: "supply-99",
          movementType: "ENTRY",
          quantity: 10,
        },
        branchLeader,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects an inactive supply", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce({
      name: "Whey",
      active: false,
    });
    prismaMock.branch.findUnique.mockResolvedValueOnce({ active: true });

    await expect(
      service.createMovement(
        {
          branchId: "branch-1",
          supplyId: "supply-1",
          movementType: "ENTRY",
          quantity: 10,
        },
        branchLeader,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("rejects an EXIT that exceeds the stock without changing it", async () => {
    mockValidSupplyAndBranch();
    prismaMock.supplyStock.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.supplyStock.findUnique.mockResolvedValueOnce({
      quantity: new Prisma.Decimal(5),
    });

    await expect(
      service.createMovement(
        {
          branchId: "branch-1",
          supplyId: "supply-1",
          movementType: "EXIT",
          quantity: 50,
          observation: "uso",
        },
        branchLeader,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prismaMock.supplyStock.updateMany).toHaveBeenCalledWith({
      where: {
        branchId: "branch-1",
        supplyId: "supply-1",
        quantity: { gte: 50 },
      },
      data: { quantity: { decrement: 50 } },
    });
    expect(prismaMock.supplyStockMovement.create).not.toHaveBeenCalled();
  });

  it("creates an ENTRY and assigns the supply to the branch when needed", async () => {
    mockValidSupplyAndBranch();
    prismaMock.supplyStock.upsert.mockResolvedValueOnce({
      quantity: new Prisma.Decimal(15),
    });
    prismaMock.supplyStockMovement.create.mockResolvedValueOnce(movementRow);

    const result = await service.createMovement(
      {
        branchId: "branch-1",
        supplyId: "supply-1",
        movementType: "ENTRY",
        quantity: 10,
      },
      branchLeader,
    );

    expect(prismaMock.supplyStock.upsert).toHaveBeenCalledWith({
      where: {
        branchId_supplyId: { branchId: "branch-1", supplyId: "supply-1" },
      },
      create: { branchId: "branch-1", supplyId: "supply-1", quantity: 10 },
      update: { quantity: { increment: 10 } },
      select: { quantity: true },
    });
    expect(result).toEqual({
      id: "mv-1",
      movementType: "ENTRY",
      quantity: "10",
      supply: { id: "supply-1", name: "Whey" },
      branch: { id: "branch-1", name: "Sede Centro" },
      user: { id: "user-2", fullName: "Ana López" },
      observation: null,
      resultingQuantity: "15",
      movementAt: movementRow.movementAt,
    });
  });

  it("creates an EXIT and returns the remaining quantity", async () => {
    mockValidSupplyAndBranch();
    prismaMock.supplyStock.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.supplyStock.findUnique.mockResolvedValueOnce({
      quantity: new Prisma.Decimal(470),
    });
    prismaMock.supplyStockMovement.create.mockResolvedValueOnce({
      ...movementRow,
      movementType: "EXIT",
      observation: "Preparación",
    });

    const result = await service.createMovement(
      {
        branchId: "branch-1",
        supplyId: "supply-1",
        movementType: "EXIT",
        quantity: 30,
        observation: "  Preparación ",
      },
      branchLeader,
    );

    expect(prismaMock.supplyStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ observation: "Preparación" }),
      }),
    );
    expect(result.resultingQuantity).toBe("470");
  });
});

describe("SupplyStockService.updateMinimum", () => {
  let service: InstanceType<typeof SupplyStockService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    );
    service = await buildService();
  });

  it("saves the minimum of the branch, audits it and returns the stock row", async () => {
    mockValidSupplyAndBranch();
    prismaMock.supplyStock.findUnique.mockResolvedValueOnce({
      minimumQuantity: new Prisma.Decimal(10),
    });
    prismaMock.supplyStock.upsert.mockResolvedValueOnce({});
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { ...stockRow, minimumQuantity: "2.500" },
    ]);

    const result = await service.updateMinimum(
      { branchId: "branch-1", supplyId: "supply-1", minimumQuantity: 2.5 },
      branchLeader,
      "127.0.0.1",
    );

    expect(prismaMock.supplyStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId_supplyId: { branchId: "branch-1", supplyId: "supply-1" },
        },
      }),
    );
    expect(auditMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "SUPPLY_STOCK",
        entityId: "supply-1",
        oldData: { branchId: "branch-1", minimumQuantity: "10" },
        newData: { branchId: "branch-1", minimumQuantity: "2.5" },
      }),
      prismaMock,
    );
    expect(result.minimumQuantity).toBe("2.500");
    expect(result.lowStock).toBe(false);
  });

  it("rejects a branch that does not exist", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce({
      name: "Whey",
      active: true,
    });
    prismaMock.branch.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.updateMinimum(
        { branchId: "branch-x", supplyId: "supply-1", minimumQuantity: 1 },
        superadmin,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
