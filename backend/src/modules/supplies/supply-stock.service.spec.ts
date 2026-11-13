import { jest, describe, beforeEach, it, expect } from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

interface TransactionClientMock {
  supplyStock: {
    update: AsyncMock;
  };
  supplyStockMovement: {
    create: AsyncMock;
  };
}

type TransactionMock = (
  operation: (tx: TransactionClientMock) => Promise<unknown>,
) => Promise<unknown>;

const prismaMock = {
  supplyStock: {
    findUnique: jest.fn<AsyncMock>(),
    update: jest.fn<AsyncMock>(),
  },
  supplyStockMovement: {
    create: jest.fn<AsyncMock>(),
  },
  $queryRaw: jest.fn<AsyncMock>(),
  $transaction: jest.fn<TransactionMock>(),
};

const executeTransaction: TransactionMock = async (operation) =>
  operation(prismaMock);

jest.unstable_mockModule("../../database/prisma/prisma.service.js", () => ({
  PrismaService: jest.fn().mockImplementation(() => prismaMock),
}));

const { Test } = await import("@nestjs/testing");
const { ForbiddenException, NotFoundException } =
  await import("@nestjs/common");
const { SupplyStockService } = await import("./supply-stock.service.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");

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
  branchId: "branch-1",
  supplyId: "supply-1",
  quantity: { lessThan: (n: number) => 5 < n, toString: () => "5.000" },
  minimumQuantity: { toString: () => "10.000" },
  updatedAt: new Date(),
};

describe("SupplyStockService.findAll", () => {
  let service: InstanceType<typeof SupplyStockService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        SupplyStockService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(SupplyStockService);
  });

  it("returns stocks for superadmin without branchId", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        supplyId: "supply-1",
        supplyName: "Whey Protein",
        unitAbreviation: "g",
        branchId: "branch-1",
        quantity: "5.000",
        minimumQuantity: "10.000",
        updatedAt: new Date(),
      },
    ]);

    const result = await service.findAll({}, superadmin);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].lowStock).toBe(true);
  });

  it("forbids non-superadmin without branchId", async () => {
    await expect(service.findAll({}, branchLeader)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("forbids branch leader requesting another branch", async () => {
    await expect(
      service.findAll({ branchId: "branch-other" }, branchLeader),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows branch leader on their assigned branch", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await service.findAll(
      { branchId: "branch-1" },
      branchLeader,
    );

    expect(result.data).toHaveLength(0);
  });
});

describe("SupplyStockService.createMovement", () => {
  let service: InstanceType<typeof SupplyStockService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    prismaMock.$transaction.mockImplementation(executeTransaction);

    const module = await Test.createTestingModule({
      providers: [
        SupplyStockService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(SupplyStockService);
  });

  it("throws NotFoundException when supply is not assigned to branch", async () => {
    prismaMock.supplyStock.findUnique.mockResolvedValueOnce(null);

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

  it("throws UnprocessableEntityException on EXIT exceeding stock", async () => {
    prismaMock.supplyStock.findUnique.mockResolvedValueOnce({
      ...stockRow,
      quantity: { lessThan: (requested: number) => 5 < requested },
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
    ).rejects.toMatchObject({
      status: 422,
      response: { code: "INSUFFICIENT_SUPPLY_STOCK" },
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.supplyStock.update).not.toHaveBeenCalled();
    expect(prismaMock.supplyStockMovement.create).not.toHaveBeenCalled();
  });

  it("creates an ENTRY movement successfully", async () => {
    prismaMock.supplyStock.findUnique.mockResolvedValueOnce({
      ...stockRow,
      quantity: { lessThan: () => false },
    });
    prismaMock.supplyStock.update.mockResolvedValueOnce({ quantity: "15.000" });
    prismaMock.supplyStockMovement.create.mockResolvedValueOnce({
      id: "mv-1",
      movementType: "ENTRY",
      quantity: "10.000",
      observation: null,
      movementAt: new Date(),
      supply: {
        id: "supply-1",
        name: "Whey",
        unitOfMeasure: { abreviation: "g" },
      },
      branch: { id: "branch-1", name: "Sede Centro" },
      user: {
        personId: "user-2",
        person: { firstName: "Ana", lastName: "López" },
      },
    });

    const result = await service.createMovement(
      {
        branchId: "branch-1",
        supplyId: "supply-1",
        movementType: "ENTRY",
        quantity: 10,
      },
      branchLeader,
    );

    expect(result.id).toBe("mv-1");
    expect(result.resultingQuantity).toBe("15.000");
    expect(prismaMock.supplyStock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId_supplyId: { branchId: "branch-1", supplyId: "supply-1" },
        },
        data: { quantity: { increment: 10 } },
      }),
    );
    expect(prismaMock.supplyStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: "ENTRY",
          quantity: 10,
          userId: branchLeader.id,
        }),
      }),
    );
  });

  it("creates an EXIT movement and decrements the stock", async () => {
    prismaMock.supplyStock.findUnique.mockResolvedValueOnce({
      ...stockRow,
      quantity: { lessThan: (requested: number) => 15 < requested },
    });
    prismaMock.supplyStock.update.mockResolvedValueOnce({
      quantity: "11.000",
    });
    prismaMock.supplyStockMovement.create.mockResolvedValueOnce({
      id: "mv-exit-1",
      movementType: "EXIT",
      quantity: "4.000",
      observation: "Consumo interno",
      movementAt: new Date(),
      supply: {
        id: "supply-1",
        name: "Whey",
        unitOfMeasure: { abreviation: "g" },
      },
      branch: { id: "branch-1", name: "Sede Centro" },
      user: {
        personId: "user-2",
        person: { firstName: "Ana", lastName: "López" },
      },
    });

    const result = await service.createMovement(
      {
        branchId: "branch-1",
        supplyId: "supply-1",
        movementType: "EXIT",
        quantity: 4,
        observation: "Consumo interno",
      },
      branchLeader,
    );

    expect(result).toMatchObject({
      id: "mv-exit-1",
      movementType: "EXIT",
      resultingQuantity: "11.000",
    });
    expect(prismaMock.supplyStock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId_supplyId: { branchId: "branch-1", supplyId: "supply-1" },
        },
        data: { quantity: { increment: -4 } },
      }),
    );
    expect(prismaMock.supplyStockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: "EXIT",
          quantity: 4,
          observation: "Consumo interno",
          userId: branchLeader.id,
        }),
      }),
    );
  });
});
