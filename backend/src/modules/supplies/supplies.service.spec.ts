import { jest, describe, beforeEach, it, expect } from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

interface TransactionClientMock {
  supply: {
    create: AsyncMock;
    update: AsyncMock;
  };
}

type TransactionOperation =
  ((tx: TransactionClientMock) => Promise<unknown>) | Promise<unknown>[];
type TransactionMock = (operation: TransactionOperation) => Promise<unknown>;

const prismaMock = {
  supply: {
    findFirst: jest.fn<AsyncMock>(),
    findUnique: jest.fn<AsyncMock>(),
    findMany: jest.fn<AsyncMock>(),
    count: jest.fn<AsyncMock>(),
    create: jest.fn<AsyncMock>(),
    update: jest.fn<AsyncMock>(),
  },
  unitMeasure: {
    findUnique: jest.fn<AsyncMock>(),
  },
  product: {
    findUnique: jest.fn<AsyncMock>(),
  },
  branch: {
    findMany: jest.fn<AsyncMock>(),
  },
  supplyStock: {
    createMany: jest.fn<AsyncMock>(),
  },
  $transaction: jest.fn<TransactionMock>(),
};

const executeTransaction: TransactionMock = async (operation) => {
  if (typeof operation === "function") {
    return operation(prismaMock);
  }

  return Promise.all(operation);
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
const { ConflictException, NotFoundException, UnprocessableEntityException } =
  await import("@nestjs/common");
const { SuppliesService } = await import("./supplies.service.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");
const { AuditService } = await import("../audit/audit.service.js");

const superadmin = {
  id: "user-1",
  active: true,
  role: { name: "SUPERADMIN" },
};

const unitActive = { id: "unit-1", active: true };
const unitInactive = { id: "unit-2", active: false };

const supplyRow = {
  id: "supply-1",
  name: "Whey Protein",
  unitOfMeasure: { id: "unit-1", name: "Gramo", abreviation: "g" },
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const formattedRow = {
  ...supplyRow,
  unitOfMeasure: { id: "unit-1", name: "Gramo", abbreviation: "g" },
};

describe("SuppliesService.create", () => {
  let service: InstanceType<typeof SuppliesService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    prismaMock.$transaction.mockImplementation(executeTransaction);
    auditMock.createAuditLog.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        SuppliesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(SuppliesService);
  });

  it("creates a supply when name is unique and unit is active", async () => {
    prismaMock.supply.findFirst.mockResolvedValueOnce(null);
    prismaMock.unitMeasure.findUnique.mockResolvedValueOnce(unitActive);
    prismaMock.supply.create.mockResolvedValueOnce(supplyRow);
    prismaMock.branch.findMany.mockResolvedValueOnce([]);

    const result = await service.create(
      { name: "Whey Protein", unitOfMeasureId: "unit-1" },
      superadmin,
      "127.0.0.1",
    );

    expect(result).toEqual(formattedRow);
    expect(prismaMock.supply.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "Whey Protein", unitOfMeasureId: "unit-1" },
      }),
    );
    expect(auditMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: superadmin.id,
        action: "CREATE",
        entity: "SUPPLY",
        entityId: supplyRow.id,
        newData: formattedRow,
        ipAddress: "127.0.0.1",
      }),
      prismaMock,
    );
    expect(prismaMock.supplyStock.createMany).not.toHaveBeenCalled();
  });

  it("assigns the new supply with stock 0 to every active branch", async () => {
    prismaMock.supply.findFirst.mockResolvedValueOnce(null);
    prismaMock.unitMeasure.findUnique.mockResolvedValueOnce(unitActive);
    prismaMock.supply.create.mockResolvedValueOnce(supplyRow);
    prismaMock.branch.findMany.mockResolvedValueOnce([
      { id: "branch-1" },
      { id: "branch-2" },
    ]);

    await service.create(
      { name: "Whey Protein", unitOfMeasureId: "unit-1" },
      superadmin,
    );

    expect(prismaMock.branch.findMany).toHaveBeenCalledWith({
      where: { active: true },
      select: { id: true },
    });
    expect(prismaMock.supplyStock.createMany).toHaveBeenCalledWith({
      data: [
        { branchId: "branch-1", supplyId: "supply-1" },
        { branchId: "branch-2", supplyId: "supply-1" },
      ],
      skipDuplicates: true,
    });
  });

  it("throws ConflictException when name already exists", async () => {
    prismaMock.supply.findFirst.mockResolvedValueOnce({ id: "existing-1" });

    await expect(
      service.create(
        { name: "Whey Protein", unitOfMeasureId: "unit-1" },
        superadmin,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.supply.create).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when unit of measure does not exist", async () => {
    prismaMock.supply.findFirst.mockResolvedValueOnce(null);
    prismaMock.unitMeasure.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.create(
        { name: "Whey Protein", unitOfMeasureId: "unit-1" },
        superadmin,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws UnprocessableEntityException when unit of measure is inactive", async () => {
    prismaMock.supply.findFirst.mockResolvedValueOnce(null);
    prismaMock.unitMeasure.findUnique.mockResolvedValueOnce(unitInactive);

    await expect(
      service.create(
        { name: "Whey Protein", unitOfMeasureId: "unit-2" },
        superadmin,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

describe("SuppliesService.findAll", () => {
  let service: InstanceType<typeof SuppliesService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        SuppliesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(SuppliesService);
  });

  it("returns paginated supplies", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([1, [supplyRow]]);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].unitOfMeasure.abbreviation).toBe("g");
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it("returns empty result when no supplies exist", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([0, []]);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(0);
    expect(result.meta.totalPages).toBe(0);
  });
});

describe("SuppliesService.findOne", () => {
  let service: InstanceType<typeof SuppliesService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        SuppliesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(SuppliesService);
  });

  it("returns supply when found", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce(supplyRow);

    const result = await service.findOne("supply-1");

    expect(result).toEqual(formattedRow);
  });

  it("throws NotFoundException when supply does not exist", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne("non-existent")).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe("SuppliesService.updateStatus", () => {
  let service: InstanceType<typeof SuppliesService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    prismaMock.$transaction.mockImplementation(executeTransaction);
    auditMock.createAuditLog.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        SuppliesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(SuppliesService);
  });

  it("deactivates an active supply", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce({
      name: "Whey",
      active: true,
    });
    prismaMock.supply.update.mockResolvedValueOnce({});

    const result = await service.updateStatus("supply-1", false, superadmin);

    expect(result).toEqual({ message: "Supply status updated successfully." });
    expect(prismaMock.supply.update).toHaveBeenCalledTimes(1);
  });

  it("throws ConflictException when supply is already in the requested state", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce({
      name: "Whey",
      active: false,
    });

    await expect(
      service.updateStatus("supply-1", false, superadmin),
    ).rejects.toThrow(ConflictException);
  });

  it("throws NotFoundException when supply does not exist", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.updateStatus("non-existent", false, superadmin),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("SuppliesService product link", () => {
  let service: InstanceType<typeof SuppliesService>;
  const jar = {
    id: "product-1",
    name: "Colágeno hidrolizado 300 g",
    active: true,
    recipe: null,
    derivedSupply: null,
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    prismaMock.$transaction.mockImplementation(executeTransaction);
    auditMock.createAuditLog.mockResolvedValue(undefined);
    prismaMock.branch.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        SuppliesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(SuppliesService);
  });

  it("names the supply after the product and ignores the name sent", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(jar);
    prismaMock.supply.findFirst.mockResolvedValueOnce(null);
    prismaMock.unitMeasure.findUnique.mockResolvedValueOnce(unitActive);
    prismaMock.supply.create.mockResolvedValueOnce({ ...supplyRow, name: jar.name });

    await service.create(
      {
        name: "Maní",
        unitOfMeasureId: "unit-1",
        sourceProductId: jar.id,
        productUnitQuantity: 300,
      },
      superadmin,
    );

    expect(prismaMock.supply.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: jar.name,
          unitOfMeasureId: "unit-1",
          sourceProductId: jar.id,
          productUnitQuantity: 300,
        },
      }),
    );
  });

  it("asks for a name when the supply does not come from a product", async () => {
    await expect(
      service.create({ unitOfMeasureId: "unit-1" }, superadmin),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: "SUPPLY_NAME_REQUIRED" },
    });
  });

  it("does not let a second supply come from the same product", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({
      ...jar,
      derivedSupply: { id: "supply-9", name: jar.name, active: false },
    });

    await expect(
      service.create(
        { unitOfMeasureId: "unit-1", sourceProductId: jar.id, productUnitQuantity: 300 },
        superadmin,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: "PRODUCT_ALREADY_LINKED",
        details: { supplyId: "supply-9", supplyName: jar.name, supplyActive: false },
      },
    });
    expect(prismaMock.supply.create).not.toHaveBeenCalled();
  });

  it("does not turn a prepared product into a supply", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({
      ...jar,
      recipe: { id: "recipe-1", name: "Batido" },
    });

    await expect(
      service.create(
        { unitOfMeasureId: "unit-1", sourceProductId: jar.id, productUnitQuantity: 300 },
        superadmin,
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: "PRODUCT_IS_PREPARED" },
    });
  });

  it("keeps the product name on a linked supply", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce({
      ...supplyRow,
      name: jar.name,
      sourceProductId: jar.id,
    });

    await expect(
      service.update("supply-1", { name: "Maní" }, superadmin),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: "SUPPLY_NAME_FROM_PRODUCT" },
    });
    expect(prismaMock.supply.update).not.toHaveBeenCalled();
  });

  it("renames the supply when it is linked to another product", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce({
      ...supplyRow,
      name: "Proteína en polvo",
      sourceProductId: null,
    });
    prismaMock.product.findUnique.mockResolvedValueOnce(jar);
    prismaMock.supply.findFirst.mockResolvedValueOnce(null);
    prismaMock.supply.update.mockResolvedValueOnce({ ...supplyRow, name: jar.name });

    await service.update(
      "supply-1",
      { sourceProductId: jar.id, productUnitQuantity: 300 },
      superadmin,
    );

    expect(prismaMock.supply.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: jar.name, sourceProductId: jar.id, productUnitQuantity: 300 },
      }),
    );
  });

  it("keeps its own supply when the product is linked again", async () => {
    prismaMock.supply.findUnique.mockResolvedValueOnce({
      ...supplyRow,
      name: jar.name,
      sourceProductId: jar.id,
    });
    prismaMock.product.findUnique.mockResolvedValueOnce({
      ...jar,
      derivedSupply: { id: "supply-1", name: jar.name, active: true },
    });
    prismaMock.supply.update.mockResolvedValueOnce({ ...supplyRow, name: jar.name });

    await service.update(
      "supply-1",
      { sourceProductId: jar.id, productUnitQuantity: 250 },
      superadmin,
    );

    expect(prismaMock.supply.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.supply.update).toHaveBeenCalled();
  });
});
