import { jest, describe, beforeEach, it, expect } from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const prismaMock = {
  branch: {
    findUnique: jest.fn<AsyncMock>(),
    findMany: jest.fn<AsyncMock>(),
    count: jest.fn<AsyncMock>(),
    create: jest.fn<AsyncMock>(),
    update: jest.fn<AsyncMock>(),
    updateMany: jest.fn<AsyncMock>(),
  },
  $transaction:
    jest.fn<
      (
        operation: (
          client: unknown,
        ) => Promise<unknown> | Array<Promise<unknown>>,
      ) => Promise<unknown>
    >(),
};

jest.unstable_mockModule("../../database/prisma/prisma.service.js", () => ({
  PrismaService: jest.fn().mockImplementation(() => prismaMock),
}));

const { Test } = await import("@nestjs/testing");
const { ConflictException } = await import("@nestjs/common");
const { BranchesService } = await import("./branches.service.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");
const { AuditService } = await import("../audit/audit.service.js");

const auditMock = {
  createAuditLog: jest.fn<AsyncMock>(),
};

const currentUser = {
  id: "admin-person-id",
  active: true,
  role: { name: "SUPERADMIN" },
};

const branchSelect = {
  id: true,
  name: true,
  address: true,
  phone: true,
  active: true,
  deliveryEnabled: true,
};

const createBranchDto = {
  name: "Sede Centro",
  address: "Carrera 10 # 20-30",
  phone: "6017000000",
};

const branchRecord = {
  id: "branch-uuid-1",
  ...createBranchDto,
  active: true,
};

describe("BranchesService.create", () => {
  let service: InstanceType<typeof BranchesService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((operation) =>
      operation(prismaMock),
    );
    prismaMock.branch.findUnique.mockResolvedValue(null);
    prismaMock.branch.create.mockResolvedValue(branchRecord);
    auditMock.createAuditLog.mockResolvedValue({});

    const module = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(BranchesService);
  });

  it("creates the branch and returns its public fields", async () => {
    const result = await service.create(
      createBranchDto,
      currentUser,
      "127.0.0.1",
    );

    expect(prismaMock.branch.findUnique).toHaveBeenCalledWith({
      where: { name: "Sede Centro" },
      select: { id: true },
    });
    expect(prismaMock.branch.create).toHaveBeenCalledWith({
      data: createBranchDto,
      select: branchSelect,
    });
    expect(result).toEqual(branchRecord);
  });

  it("records the creation in the audit log inside the same transaction", async () => {
    await service.create(createBranchDto, currentUser, "127.0.0.1");

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(auditMock.createAuditLog).toHaveBeenCalledWith(
      {
        userId: "admin-person-id",
        action: "CREATE",
        entity: "BRANCH",
        entityId: "branch-uuid-1",
        newData: branchRecord,
        reason: "Creación de la sede Sede Centro",
        ipAddress: "127.0.0.1",
      },
      prismaMock,
    );
  });

  it("rejects a duplicated name without creating the branch", async () => {
    prismaMock.branch.findUnique.mockResolvedValue({ id: "branch-uuid-2" });

    await expect(
      service.create(createBranchDto, currentUser, "127.0.0.1"),
    ).rejects.toThrow(new ConflictException("Branch name already exists"));

    expect(prismaMock.branch.create).not.toHaveBeenCalled();
    expect(auditMock.createAuditLog).not.toHaveBeenCalled();
  });

  it("maps a unique constraint violation to a duplicated name conflict", async () => {
    prismaMock.branch.create.mockRejectedValue({ code: "P2002" });

    await expect(
      service.create(createBranchDto, currentUser, "127.0.0.1"),
    ).rejects.toThrow(new ConflictException("Branch name already exists"));

    expect(auditMock.createAuditLog).not.toHaveBeenCalled();
  });

  it("propagates unexpected database errors", async () => {
    const databaseError = new Error("connection lost");
    prismaMock.branch.create.mockRejectedValue(databaseError);

    await expect(
      service.create(createBranchDto, currentUser, "127.0.0.1"),
    ).rejects.toBe(databaseError);
  });
});

describe("BranchesService.findAll", () => {
  let service: InstanceType<typeof BranchesService>;

  const row = {
    ...branchRecord,
    deliveryEnabled: false,
    schedules: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((operation) =>
      Array.isArray(operation) ? Promise.all(operation) : operation(prismaMock),
    );
    prismaMock.branch.count.mockResolvedValue(0);
    prismaMock.branch.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(BranchesService);
  });

  it("returns the page with the weekly schedule attached", async () => {
    prismaMock.branch.count.mockResolvedValue(3);
    prismaMock.branch.findMany.mockResolvedValue([row]);

    const result: any = await service.findAll({ page: 2, limit: 2 });

    expect(result.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(result.data[0]).toMatchObject({
      id: "branch-uuid-1",
      name: "Sede Centro",
      active: true,
      openNow: false,
    });
    expect(result.data[0].schedule).toHaveLength(7);
    expect(result.data[0]).not.toHaveProperty("schedules");
    expect(prismaMock.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2, take: 2, orderBy: { name: "asc" } }),
    );
  });

  it("reports zero pages when there are no branches", async () => {
    const result: any = await service.findAll({ page: 1, limit: 10 });

    expect(result.meta.totalPages).toBe(0);
  });

  it("filters by status and name", async () => {
    await service.findAll({
      page: 1,
      limit: 10,
      active: true,
      search: "centro",
    });

    expect(prismaMock.branch.count).toHaveBeenCalledWith({
      where: {
        active: true,
        name: { contains: "centro", mode: "insensitive" },
      },
    });
  });
});

describe("BranchesService.findOne", () => {
  let service: InstanceType<typeof BranchesService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(BranchesService);
  });

  it("returns the branch with its schedule", async () => {
    prismaMock.branch.findUnique.mockResolvedValue({
      ...branchRecord,
      deliveryEnabled: true,
      schedules: [],
    });

    const result: any = await service.findOne("branch-uuid-1");

    expect(result).toMatchObject({ id: "branch-uuid-1", name: "Sede Centro" });
    expect(result.schedule).toHaveLength(7);
    expect(prismaMock.branch.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "branch-uuid-1" } }),
    );
  });

  it("returns not found for a missing branch", async () => {
    prismaMock.branch.findUnique.mockResolvedValue(null);

    await expect(service.findOne("missing")).rejects.toMatchObject({
      status: 404,
      message: "Branch not found",
    });
  });
});

describe("BranchesService.update", () => {
  let service: InstanceType<typeof BranchesService>;

  const existing = {
    id: "branch-uuid-1",
    name: "Sede Centro",
    address: "Carrera 10 # 20-30",
    phone: "6017000000",
    active: true,
    deliveryEnabled: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((operation) =>
      Array.isArray(operation) ? Promise.all(operation) : operation(prismaMock),
    );
    auditMock.createAuditLog.mockResolvedValue({});

    const module = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(BranchesService);
  });

  it("rejects an empty update", async () => {
    await expect(
      service.update("branch-uuid-1", {}, currentUser),
    ).rejects.toThrow("At least one field must be provided");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns not found for a missing branch", async () => {
    prismaMock.branch.findUnique.mockResolvedValue(null);

    await expect(
      service.update("missing", { name: "Nueva" }, currentUser),
    ).rejects.toMatchObject({ status: 404, message: "Branch not found" });
  });

  it("updates the branch and records the audit log", async () => {
    const updated = { ...existing, name: "Sede Norte" };
    prismaMock.branch.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    prismaMock.branch.update.mockResolvedValue(updated);

    const result: unknown = await service.update(
      "branch-uuid-1",
      { name: "Sede Norte" },
      currentUser,
      "127.0.0.1",
    );

    expect(result).toBe(updated);
    expect(prismaMock.branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "branch-uuid-1" },
        data: { name: "Sede Norte" },
      }),
    );
    expect(auditMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "BRANCH",
        entityId: "branch-uuid-1",
        ipAddress: "127.0.0.1",
      }),
      prismaMock,
    );
  });

  it("rejects a name that another branch already uses", async () => {
    prismaMock.branch.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ id: "branch-uuid-2" });

    await expect(
      service.update("branch-uuid-1", { name: "Sede Norte" }, currentUser),
    ).rejects.toMatchObject({
      status: 409,
      message: "Branch name already exists",
    });
    expect(prismaMock.branch.update).not.toHaveBeenCalled();
  });

  it("maps a unique constraint violation to a duplicated name conflict", async () => {
    prismaMock.branch.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    prismaMock.branch.update.mockRejectedValue({ code: "P2002" });

    await expect(
      service.update("branch-uuid-1", { name: "Sede Norte" }, currentUser),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("BranchesService.updateStatus", () => {
  let service: InstanceType<typeof BranchesService>;

  const existing = { id: "branch-uuid-1", name: "Sede Centro", active: true };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((operation) =>
      Array.isArray(operation) ? Promise.all(operation) : operation(prismaMock),
    );
    prismaMock.branch.findUnique.mockReset();
    prismaMock.branch.updateMany.mockResolvedValue({ count: 1 });
    auditMock.createAuditLog.mockResolvedValue({});

    const module = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(BranchesService);
  });

  it("deactivates the branch and records the audit log", async () => {
    prismaMock.branch.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({
        ...branchRecord,
        active: false,
        deliveryEnabled: false,
      });

    const result: unknown = await service.updateStatus(
      "branch-uuid-1",
      false,
      currentUser,
      "127.0.0.1",
    );

    expect(result).toMatchObject({ id: "branch-uuid-1", active: false });
    expect(prismaMock.branch.updateMany).toHaveBeenCalledWith({
      where: { id: "branch-uuid-1", active: true },
      data: { active: false },
    });
    expect(auditMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DEACTIVATE",
        oldData: { active: true },
        newData: { active: false },
        ipAddress: "127.0.0.1",
      }),
      prismaMock,
    );
  });

  it("returns not found for a missing branch", async () => {
    prismaMock.branch.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus("missing", false, currentUser),
    ).rejects.toMatchObject({ status: 404, message: "Branch not found" });
  });

  it("rejects a status change to the current state", async () => {
    prismaMock.branch.findUnique.mockResolvedValue(existing);

    await expect(
      service.updateStatus("branch-uuid-1", true, currentUser),
    ).rejects.toMatchObject({
      status: 400,
      message: "Branch is already active",
    });
    expect(prismaMock.branch.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when the conditional update matches no row", async () => {
    prismaMock.branch.findUnique.mockResolvedValueOnce(existing);
    prismaMock.branch.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateStatus("branch-uuid-1", false, currentUser),
    ).rejects.toMatchObject({
      status: 400,
      message: "Branch status has already changed",
    });
    expect(auditMock.createAuditLog).not.toHaveBeenCalled();
  });
});
