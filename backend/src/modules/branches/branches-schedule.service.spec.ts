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
    count: jest.fn<AsyncMock>(),
  },
  branchSchedule: {
    deleteMany: jest.fn<AsyncMock>(),
    createMany: jest.fn<AsyncMock>(),
  },
  $transaction: jest.fn<(arg: unknown) => Promise<unknown>>(),
};

jest.unstable_mockModule("../../database/prisma/prisma.service.js", () => ({
  PrismaService: jest.fn().mockImplementation(() => prismaMock),
}));

const { Test } = await import("@nestjs/testing");
const { BadRequestException, NotFoundException } =
  await import("@nestjs/common");
const { BranchesService } = await import("./branches.service.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");
const { AuditService } = await import("../audit/audit.service.js");

const auditMock = { createAuditLog: jest.fn<AsyncMock>() };
const currentUser = {
  id: "admin-person-id",
  active: true,
  role: { name: "SUPERADMIN" },
};
const branch = {
  id: "branch-1",
  name: "Sede Makro",
  address: "Calle 1",
  phone: "3001",
  active: true,
};
const lunchBreak = [
  { opensAt: "08:00", closesAt: "13:00" },
  { opensAt: "15:00", closesAt: "20:00" },
];

describe("BranchesService schedule", () => {
  let service: InstanceType<typeof BranchesService>;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-11-16T14:00:00.000Z") });
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation((arg) =>
      typeof arg === "function"
        ? (arg as (client: unknown) => Promise<unknown>)(prismaMock)
        : Promise.all(arg as Promise<unknown>[]),
    );
    prismaMock.branch.findUnique.mockResolvedValue({
      ...branch,
      schedules: [{ dayOfWeek: 1, opensAt: "09:00", closesAt: "18:00" }],
    });
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

  afterEach(() => {
    jest.useRealTimers();
  });

  it("lists the branches with their week and whether they are open now", async () => {
    prismaMock.branch.count.mockResolvedValue(2);
    prismaMock.branch.findMany.mockResolvedValue([
      {
        ...branch,
        schedules: [
          { dayOfWeek: 1, opensAt: "08:00", closesAt: "13:00" },
          { dayOfWeek: 1, opensAt: "15:00", closesAt: "20:00" },
        ],
      },
      {
        ...branch,
        id: "branch-2",
        active: false,
        schedules: [{ dayOfWeek: 1, opensAt: "08:00", closesAt: "20:00" }],
      },
    ]);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.data[0]).toEqual({
      ...branch,
      openNow: true,
      schedule: expect.arrayContaining([
        { dayOfWeek: 1, intervals: lunchBreak },
        { dayOfWeek: 7, intervals: [] },
      ]),
    });
    expect(result.data[1].openNow).toBe(false);
  });

  it("replaces the schedule and audits the change", async () => {
    const result = await service.updateSchedule(
      branch.id,
      {
        days: [
          { dayOfWeek: 1, intervals: [...lunchBreak].reverse() },
          { dayOfWeek: 7, intervals: [] },
        ],
      },
      currentUser,
      "127.0.0.1",
    );

    expect(prismaMock.branchSchedule.deleteMany).toHaveBeenCalledWith({
      where: { branchId: branch.id },
    });
    expect(prismaMock.branchSchedule.createMany).toHaveBeenCalledWith({
      data: [
        { branchId: branch.id, dayOfWeek: 1, ...lunchBreak[0] },
        { branchId: branch.id, dayOfWeek: 1, ...lunchBreak[1] },
      ],
    });
    expect(result.schedule[0]).toEqual({ dayOfWeek: 1, intervals: lunchBreak });
    expect(result.openNow).toBe(true);
    expect(auditMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE",
        entity: "BRANCH",
        entityId: branch.id,
        oldData: {
          schedule: expect.arrayContaining([
            {
              dayOfWeek: 1,
              intervals: [{ opensAt: "09:00", closesAt: "18:00" }],
            },
          ]),
        },
      }),
      prismaMock,
    );
  });

  it("clears the schedule when no day is sent", async () => {
    const result = await service.updateSchedule(
      branch.id,
      { days: [] },
      currentUser,
    );

    expect(prismaMock.branchSchedule.createMany).not.toHaveBeenCalled();
    expect(result.openNow).toBe(false);
  });

  it.each([
    [
      "DUPLICATED_DAY",
      [
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 2, intervals: [] },
      ],
    ],
    [
      "INVALID_INTERVAL",
      [
        {
          dayOfWeek: 2,
          intervals: [{ opensAt: "13:00", closesAt: "13:00" }],
        },
      ],
    ],
    [
      "OVERLAPPING_INTERVALS",
      [
        {
          dayOfWeek: 2,
          intervals: [
            { opensAt: "08:00", closesAt: "14:00" },
            { opensAt: "13:00", closesAt: "18:00" },
          ],
        },
      ],
    ],
  ])("rejects %s", async (code, days) => {
    const promise = service.updateSchedule(branch.id, { days }, currentUser);

    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toMatchObject({ response: { code } });
    expect(prismaMock.branchSchedule.deleteMany).not.toHaveBeenCalled();
  });

  it("throws when the branch does not exist", async () => {
    prismaMock.branch.findUnique.mockResolvedValue(null);

    await expect(
      service.updateSchedule("missing", { days: [] }, currentUser),
    ).rejects.toThrow(NotFoundException);
  });
});
