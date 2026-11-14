import { beforeEach, describe, expect, it, jest } from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const tx = {
  onlineOrder: {
    findFirst: jest.fn<AsyncMock>(),
    update: jest.fn<AsyncMock>(),
    updateMany: jest.fn<AsyncMock>(),
  },
};
const prismaMock = {
  ...tx,
  $transaction:
    jest.fn<
      (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
    >(),
};

jest.unstable_mockModule("../../database/prisma/prisma.service.js", () => ({
  PrismaService: jest.fn().mockImplementation(() => prismaMock),
}));

const { Test } = await import("@nestjs/testing");
const { ConflictException, ForbiddenException, NotFoundException } =
  await import("@nestjs/common");
const { OnlineOrdersService } = await import("./online-orders.service.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");
const { AuditService } = await import("../audit/audit.service.js");
const { PersonsService } = await import("../persons/persons.service.js");
const { SalesService } = await import("../sales/sales.service.js");

const auditMock = { createAuditLog: jest.fn<AsyncMock>() };
const leader = {
  id: "leader",
  active: true,
  role: { name: "BRANCH_LEADER" },
  branches: [{ id: "makro", name: "Sede Makro" }],
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    code: "P-20261114-0001",
    status: "PENDING",
    fulfillment: "PICKUP",
    customerName: "Camilo Rojas",
    customerPhone: "3114827719",
    customerEmail: null,
    deliveryAddress: null,
    deliveryNeighborhood: null,
    notes: null,
    subtotal: "450000.00",
    expiresAt: new Date(Date.now() + 3_600_000),
    cancelReason: null,
    confirmedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    branch: { id: "makro", name: "Sede Makro", address: "Calle 1", phone: "1" },
    customer: null,
    sale: null,
    items: [],
    ...overrides,
  };
}

describe("OnlineOrdersService", () => {
  let service: InstanceType<typeof OnlineOrdersService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation((callback) => callback(tx));
    auditMock.createAuditLog.mockResolvedValue({});
    const module = await Test.createTestingModule({
      providers: [
        OnlineOrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        { provide: PersonsService, useValue: {} },
        { provide: SalesService, useValue: {} },
      ],
    }).compile();
    service = module.get(OnlineOrdersService);
  });

  it("shows a pending order past its hold as expired", async () => {
    tx.onlineOrder.findFirst.mockResolvedValue(
      order({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const result = await service.findOne("order-1", leader);

    expect(result.status).toBe("EXPIRED");
    expect(tx.onlineOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1", branchId: { in: ["makro"] } },
      }),
    );
  });

  it("answers ORDER_NOT_FOUND outside the branches of the user", async () => {
    tx.onlineOrder.findFirst.mockResolvedValue(null);

    await expect(service.findOne("order-1", leader)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("does not let a branch role filter another branch", async () => {
    await expect(
      service.findAll({ page: 1, limit: 20, branchId: "viva" }, leader),
    ).rejects.toThrow(ForbiddenException);
  });

  it("confirms a pending order and audits the change", async () => {
    tx.onlineOrder.findFirst.mockResolvedValue(order());
    tx.onlineOrder.update.mockResolvedValue(order({ status: "CONFIRMED" }));

    const result = await service.updateStatus(
      "order-1",
      { status: "CONFIRMED" },
      leader,
    );

    expect(result.status).toBe("CONFIRMED");
    expect(tx.onlineOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CONFIRMED",
          confirmedAt: expect.any(Date),
        }),
      }),
    );
    expect(auditMock.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "ONLINE_ORDER", action: "UPDATE" }),
      tx,
    );
  });

  it.each([
    ["READY", { status: "PENDING" }, "INVALID_STATUS_TRANSITION"],
    ["OUT_FOR_DELIVERY", { status: "CONFIRMED" }, "INVALID_STATUS_TRANSITION"],
    ["CONFIRMED", { status: "DELIVERED" }, "INVALID_STATUS_TRANSITION"],
    ["CONFIRMED", { expiresAt: new Date(Date.now() - 1000) }, "ORDER_EXPIRED"],
  ] as const)("rejects moving to %s (%#)", async (status, overrides, code) => {
    tx.onlineOrder.findFirst.mockResolvedValue(order(overrides));

    const promise = service.updateStatus("order-1", { status }, leader);

    await expect(promise).rejects.toThrow(ConflictException);
    await expect(promise).rejects.toMatchObject({ response: { code } });
    expect(tx.onlineOrder.update).not.toHaveBeenCalled();
  });

  it("expires the pending orders past their hold", async () => {
    tx.onlineOrder.updateMany.mockResolvedValue({ count: 2 });
    const now = new Date("2026-11-14T10:00:00.000Z");

    await expect(service.expirePendingOrders(now)).resolves.toBe(2);
    expect(tx.onlineOrder.updateMany).toHaveBeenCalledWith({
      where: { status: "PENDING", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
  });
});
