import { jest, describe, beforeEach, it, expect } from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;
type SyncMock = (...args: unknown[]) => unknown;

const prismaMock = {
  cashShift: {
    findFirst: jest.fn<AsyncMock>(),
    findUnique: jest.fn<AsyncMock>(),
    findMany: jest.fn<AsyncMock>(),
    count: jest.fn<AsyncMock>(),
    create: jest.fn<AsyncMock>(),
    update: jest.fn<AsyncMock>(),
  },
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
const { ConflictException, ForbiddenException, NotFoundException } =
  await import("@nestjs/common");
const { CashShiftsService } = await import("./cash-shifts.service.js");
const { PrismaService } = await import(
  "../../database/prisma/prisma.service.js"
);
const { AuditService } = await import("../audit/audit.service.js");

const superadmin = {
  id: "user-admin",
  active: true,
  role: { name: "SUPERADMIN" },
  branches: [],
};

const branchLeader = {
  id: "user-leader",
  active: true,
  role: { name: "BRANCH_LEADER" },
  branches: [{ id: "branch-1", name: "Sede Centro" }],
};

const assistant = {
  id: "user-asst",
  active: true,
  role: { name: "BRANCH_ASSISTANT" },
  branches: [{ id: "branch-1", name: "Sede Centro" }],
};

const shiftRow = {
  id: "shift-1",
  branch: { id: "branch-1", name: "Sede Centro" },
  user: { personId: "user-leader", person: { firstName: "Laura", lastName: "Pérez" } },
  status: "OPEN",
  openedAt: new Date("2026-11-06T08:00:00Z"),
  closedAt: null,
  openingAmount: { toString: () => "50000.00" },
  closingAmount: null,
  observation: "Apertura turno mañana",
};

describe("CashShiftsService.open", () => {
  let service: InstanceType<typeof CashShiftsService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    );
    auditMock.createAuditLog.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        CashShiftsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(CashShiftsService);
  });

  it("opens a cash shift when no other shift is open", async () => {
    prismaMock.cashShift.findFirst.mockResolvedValueOnce(null);
    prismaMock.cashShift.create.mockResolvedValueOnce(shiftRow);

    const result = await service.open(
      { branchId: "branch-1", openingAmount: "50000.00", observation: "Apertura" },
      branchLeader,
    );

    expect(result.id).toBe("shift-1");
    expect(result.status).toBe("OPEN");
    expect(prismaMock.cashShift.create).toHaveBeenCalledTimes(1);
  });

  it("throws ConflictException when user already has an open shift", async () => {
    prismaMock.cashShift.findFirst.mockResolvedValueOnce({ id: "shift-existing" });

    await expect(
      service.open({ branchId: "branch-1", openingAmount: "50000.00" }, branchLeader),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.cashShift.create).not.toHaveBeenCalled();
  });
});

describe("CashShiftsService.close", () => {
  let service: InstanceType<typeof CashShiftsService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    );
    auditMock.createAuditLog.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        CashShiftsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(CashShiftsService);
  });

  it("closes an open shift when called by the owner", async () => {
    prismaMock.cashShift.findUnique.mockResolvedValueOnce({
      id: "shift-1",
      userId: "user-leader",
      status: "OPEN",
      branchId: "branch-1",
      openingAmount: { toString: () => "50000.00" },
    });
    prismaMock.cashShift.update.mockResolvedValueOnce({
      ...shiftRow,
      status: "CLOSED",
      closedAt: new Date(),
      closingAmount: { toString: () => "380000.00" },
    });

    const result = await service.close(
      "shift-1",
      { closingAmount: "380000.00" },
      branchLeader,
    );

    expect(result.status).toBe("CLOSED");
  });

  it("allows SUPERADMIN to close any shift", async () => {
    prismaMock.cashShift.findUnique.mockResolvedValueOnce({
      id: "shift-1",
      userId: "user-other",
      status: "OPEN",
      branchId: "branch-1",
      openingAmount: { toString: () => "50000.00" },
    });
    prismaMock.cashShift.update.mockResolvedValueOnce({
      ...shiftRow,
      status: "CLOSED",
      closedAt: new Date(),
      closingAmount: { toString: () => "380000.00" },
    });

    const result = await service.close(
      "shift-1",
      { closingAmount: "380000.00" },
      superadmin,
    );

    expect(result.status).toBe("CLOSED");
  });

  it("throws ForbiddenException when non-owner tries to close the shift", async () => {
    prismaMock.cashShift.findUnique.mockResolvedValueOnce({
      id: "shift-1",
      userId: "user-other",
      status: "OPEN",
      branchId: "branch-1",
      openingAmount: { toString: () => "50000.00" },
    });

    await expect(
      service.close("shift-1", { closingAmount: "380000.00" }, branchLeader),
    ).rejects.toThrow(ForbiddenException);
  });

  it("throws ConflictException when shift is already closed", async () => {
    prismaMock.cashShift.findUnique.mockResolvedValueOnce({
      id: "shift-1",
      userId: "user-leader",
      status: "CLOSED",
      branchId: "branch-1",
      openingAmount: { toString: () => "50000.00" },
    });

    await expect(
      service.close("shift-1", { closingAmount: "380000.00" }, branchLeader),
    ).rejects.toThrow(ConflictException);
  });

  it("throws NotFoundException when shift does not exist", async () => {
    prismaMock.cashShift.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.close("non-existent", { closingAmount: "380000.00" }, branchLeader),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("CashShiftsService.findAll", () => {
  let service: InstanceType<typeof CashShiftsService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        CashShiftsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(CashShiftsService);
  });

  it("returns paginated shifts for superadmin", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([1, [shiftRow]]);

    const result = await service.findAll({ page: 1, limit: 20 }, superadmin);

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it("forbids branch leader without branchId", async () => {
    await expect(
      service.findAll({ page: 1, limit: 20 }, branchLeader),
    ).rejects.toThrow(ForbiddenException);
  });

  it("forbids branch leader requesting another branch", async () => {
    await expect(
      service.findAll({ branchId: "branch-other", page: 1, limit: 20 }, branchLeader),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows branch leader on their assigned branch", async () => {
    prismaMock.$transaction.mockResolvedValueOnce([0, []]);

    const result = await service.findAll(
      { branchId: "branch-1", page: 1, limit: 20 },
      branchLeader,
    );

    expect(result.data).toHaveLength(0);
    expect(result.meta.totalPages).toBe(0);
  });
});

describe("CashShiftsService.findOne", () => {
  let service: InstanceType<typeof CashShiftsService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        CashShiftsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get(CashShiftsService);
  });

  it("returns shift when found", async () => {
    prismaMock.cashShift.findUnique.mockResolvedValueOnce(shiftRow);

    const result = await service.findOne("shift-1");

    expect(result.id).toBe("shift-1");
    expect(result.user.fullName).toBe("Laura Pérez");
  });

  it("throws NotFoundException when shift does not exist", async () => {
    prismaMock.cashShift.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne("non-existent")).rejects.toThrow(NotFoundException);
  });
});
