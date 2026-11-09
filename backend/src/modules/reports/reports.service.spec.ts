import { jest, describe, beforeEach, it, expect } from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const prismaMock = {
  $queryRaw: jest.fn<AsyncMock>(),
};

jest.unstable_mockModule("../../database/prisma/prisma.service.js", () => ({
  PrismaService: jest.fn().mockImplementation(() => prismaMock),
}));

const { Test } = await import("@nestjs/testing");
const { BadRequestException, ForbiddenException } =
  await import("@nestjs/common");
const { ReportsService } = await import("./reports.service.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");

const superadmin = {
  id: "superadmin-id",
  active: true,
  role: { name: "SUPERADMIN" },
};

const branchLeader = {
  id: "branch-leader-id",
  active: true,
  role: { name: "BRANCH_LEADER" },
  branches: [{ id: "branch-assigned", name: "Sede Centro" }],
};

describe("ReportsService.getSalesReport", () => {
  let service: InstanceType<typeof ReportsService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ total: 23 }])
      .mockResolvedValueOnce([
        {
          day: "2026-10-26",
          branchId: "branch-assigned",
          branchName: "Sede Centro",
          salesCount: 4,
          totalAmount: "235.50",
        },
      ]);

    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(ReportsService);
  });

  it("returns grouped sales and pagination metadata for a superadmin", async () => {
    const result = await service.getSalesReport(
      {
        from: "2026-10-01",
        to: "2026-10-31",
        branchId: "branch-assigned",
        page: 2,
        limit: 10,
      },
      superadmin,
    );

    expect(result).toEqual({
      data: [
        {
          day: "2026-10-26",
          branch: { id: "branch-assigned", name: "Sede Centro" },
          salesCount: 4,
          totalAmount: "235.50",
        },
      ],
      meta: { page: 2, limit: 10, total: 23, totalPages: 3 },
    });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("allows a branch leader to report on their assigned branch", async () => {
    const result = await service.getSalesReport(
      {
        from: "2026-10-01",
        to: "2026-10-31",
        branchId: "branch-assigned",
        page: 1,
        limit: 20,
      },
      branchLeader,
    );

    expect(result.data).toHaveLength(1);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("forbids a branch leader from requesting another branch", async () => {
    await expect(
      service.getSalesReport(
        { branchId: "branch-other", page: 1, limit: 20 },
        branchLeader,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("forbids a branch leader when no branch filter is provided", async () => {
    await expect(
      service.getSalesReport({ page: 1, limit: 20 }, branchLeader),
    ).rejects.toThrow(ForbiddenException);

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a date range whose start is after its end", async () => {
    await expect(
      service.getSalesReport(
        { from: "2026-10-31", to: "2026-10-01", page: 1, limit: 20 },
        superadmin,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});
