import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";
import { OnlineOrdersService } from "../src/modules/online-orders/online-orders.service.js";

type Role = "SUPERADMIN" | "BRANCH_LEADER" | "DEV";

interface OrderBody {
  id: string;
  code: string;
  status: string;
  fulfillment: string;
  branch: { id: string; name: string };
  customer: { id: string | null; registered: boolean; phone: string };
  items: { productId: string; quantity: number; unitPrice: string }[];
  subtotal: string;
  expiresAt: string;
  sale: { id: string; saleNumber: string; total: string } | null;
}

interface AvailabilityBody {
  branches: {
    branchId: string;
    allAvailable: boolean;
    deliveryEnabled: boolean;
    items: { productId: string; available: number }[];
  }[];
  deliveryAvailable: boolean;
}

const runId = Date.now().toString(36);
const DOCUMENT_CODE = `CC-ORD-${runId}`.slice(0, 20);
const future = new Date("2029-06-01T00:00:00.000Z");
const data = <T>(response: request.Response) =>
  (response.body as { data: T }).data;

describe("Online orders (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const tokens = {} as Record<Role, string>;
  const personIds: string[] = [];
  const ids = {
    pickup: "",
    delivery: "",
    smallDelivery: "",
    category: "",
    unit: "",
    whey: "",
    creatine: "",
    documentType: "",
    cash: "",
  };
  const branchIds = () => [ids.pickup, ids.delivery, ids.smallDelivery];
  const created: string[] = [];

  const server = () => request(app.getHttpServer());
  const placeOrder = async (body: object) => {
    const response = await server().post("/api/v1/orders").send(body);
    if (response.status === 201) created.push(data<OrderBody>(response).id);
    return response;
  };
  const customer = (overrides: object = {}) => ({
    firstName: "Camilo",
    lastName: "Rojas",
    phone: "3114827719",
    register: false,
    ...overrides,
  });
  const auth = (role: Role) => ({ Authorization: `Bearer ${tokens[role]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    ids.documentType = (
      await prisma.documentType.create({
        data: { code: DOCUMENT_CODE, name: "Cédula (e2e pedidos)" },
      })
    ).id;
    const branch = async (name: string, deliveryEnabled: boolean) =>
      (
        await prisma.branch.create({
          data: {
            name: `${runId} ${name}`,
            address: "Calle 1, Tunja",
            phone: "1",
            deliveryEnabled,
          },
        })
      ).id;
    ids.pickup = await branch("Recoger pedidos", false);
    ids.delivery = await branch("Domicilio grande", true);
    ids.smallDelivery = await branch("Domicilio chica", true);
    ids.category = (
      await prisma.category.create({ data: { name: `${runId} Cat pedidos` } })
    ).id;
    ids.unit = (
      await prisma.unitMeasure.create({
        data: {
          name: `${runId} Und pedidos`,
          abreviation: `O${runId.slice(-8)}`,
        },
      })
    ).id;
    const product = async (name: string, price: string) =>
      (
        await prisma.product.create({
          data: {
            name: `${runId} ${name}`,
            referenceCode: `ORD-${name}-${runId}`,
            categoryId: ids.category,
            unitOfMeasureId: ids.unit,
            price,
          },
        })
      ).id;
    ids.whey = await product("Whey", "150000.00");
    ids.creatine = await product("Creatina", "90000.00");
    await prisma.branchInventory.createMany({
      data: [
        {
          branchId: ids.pickup,
          productId: ids.whey,
          quantity: 4,
          expirationDate: future,
        },
        {
          branchId: ids.pickup,
          productId: ids.creatine,
          quantity: 2,
          expirationDate: future,
        },
        {
          branchId: ids.delivery,
          productId: ids.whey,
          quantity: 10,
          expirationDate: future,
        },
        {
          branchId: ids.delivery,
          productId: ids.creatine,
          quantity: 5,
          expirationDate: future,
        },
        {
          branchId: ids.smallDelivery,
          productId: ids.whey,
          quantity: 1,
          expirationDate: future,
        },
      ],
    });
    ids.cash = (
      await prisma.paymentMethod.create({
        data: {
          code: `ORD_${runId.toUpperCase()}`.slice(0, 20),
          name: `Efectivo pedidos ${runId}`,
        },
      })
    ).id;

    const jwt = app.get(JwtService);
    for (const [index, roleName] of (
      ["SUPERADMIN", "BRANCH_LEADER", "DEV"] as const
    ).entries()) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: { active: true },
        create: { name: roleName },
      });
      const person = await prisma.person.create({
        data: {
          documentTypeId: ids.documentType,
          documentNumber: `${runId}${index}`,
          firstName: roleName,
          lastName: "Pedidos",
          email: `${roleName.toLowerCase()}.orders.${runId}@e2e.test`,
          phone: "3000000000",
          address: "Calle 1",
          userAccount: {
            create: {
              roleId: role.id,
              active: true,
              mustChangePassword: false,
            },
          },
        },
      });
      personIds.push(person.id);
      tokens[roleName] = await jwt.signAsync({ sub: person.id });
      if (roleName === "BRANCH_LEADER") {
        await prisma.userBranch.create({
          data: {
            userId: person.id,
            branchId: ids.pickup,
            assignmentDate: new Date(),
          },
        });
      }
    }
  }, 60000);

  afterAll(async () => {
    if (!prisma) return;
    const orders = await prisma.onlineOrder.findMany({
      where: { branchId: { in: branchIds() } },
      select: { id: true, saleId: true, customerId: true },
    });
    const saleIds = (
      await prisma.sale.findMany({
        where: { branchId: { in: branchIds() } },
        select: { id: true },
      })
    ).map((sale) => sale.id);
    const customerIds = orders.flatMap((order) =>
      order.customerId ? [order.customerId] : [],
    );
    await prisma.onlineOrder.deleteMany({
      where: { branchId: { in: branchIds() } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { productId: { in: [ids.whey, ids.creatine] } },
    });
    await prisma.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.saleDetail.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.notification.deleteMany({
      where: { branchId: { in: branchIds() } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        entity: "ONLINE_ORDER",
        entityId: { in: orders.map((order) => order.id) },
      },
    });
    await prisma.inventoryClosure.deleteMany({
      where: { branchId: { in: branchIds() } },
    });
    await prisma.branchInventory.deleteMany({
      where: { branchId: { in: branchIds() } },
    });
    await prisma.paymentMethod.deleteMany({ where: { id: ids.cash } });
    await prisma.userBranch.deleteMany({
      where: { userId: { in: personIds } },
    });
    await prisma.userAccount.deleteMany({
      where: { personId: { in: personIds } },
    });
    await prisma.customer.deleteMany({
      where: { personId: { in: customerIds } },
    });
    await prisma.person.deleteMany({
      where: {
        OR: [
          { id: { in: [...personIds, ...customerIds] } },
          { documentTypeId: ids.documentType },
        ],
      },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [ids.whey, ids.creatine] } },
    });
    await prisma.category.deleteMany({ where: { id: ids.category } });
    await prisma.unitMeasure.deleteMany({ where: { id: ids.unit } });
    await prisma.branch.deleteMany({ where: { id: { in: branchIds() } } });
    await prisma.documentType.deleteMany({ where: { id: ids.documentType } });
    await app.close();
  }, 60000);

  it("checks a cart against every branch without a token", async () => {
    const response = await server()
      .post("/api/v1/orders/availability")
      .send({
        items: [
          { productId: ids.whey, quantity: 3 },
          { productId: ids.creatine, quantity: 2 },
        ],
      });

    expect(response.status).toBe(200);
    const body = data<AvailabilityBody>(response);
    const byId = new Map(
      body.branches.map((branch) => [branch.branchId, branch]),
    );
    expect(byId.get(ids.pickup)).toMatchObject({
      allAvailable: true,
      deliveryEnabled: false,
    });
    expect(byId.get(ids.smallDelivery)).toMatchObject({
      allAvailable: false,
      items: [
        { productId: ids.whey, available: 1 },
        { productId: ids.creatine, available: 0 },
      ],
    });
    expect(body.deliveryAvailable).toBe(true);
  });

  it("places a pickup order, holds its units and notifies the branch staff", async () => {
    const response = await placeOrder({
      fulfillment: "PICKUP",
      branchId: ids.pickup,
      items: [{ productId: ids.whey, quantity: 3 }],
      customer: customer(),
      notes: "Paso en la tarde",
    });

    expect(response.status).toBe(201);
    const order = data<OrderBody>(response);
    expect(order.code).toMatch(/^P-\d{8}-\d{4}$/);
    expect(order).toMatchObject({
      status: "PENDING",
      fulfillment: "PICKUP",
      branch: { id: ids.pickup },
      customer: { id: null, registered: false, phone: "3114827719" },
      subtotal: "450000.00",
    });
    const holdHours = (Date.parse(order.expiresAt) - Date.now()) / 3_600_000;
    expect(holdHours).toBeGreaterThan(47.9);
    const notified = await prisma.notification.findMany({
      where: { branchId: ids.pickup, type: "ONLINE_ORDER" },
      select: { userId: true, title: true },
    });
    expect(notified.map((item) => item.userId)).toEqual(
      expect.arrayContaining([personIds[0], personIds[1]]),
    );
    expect(notified[0].title).toBe(`Nuevo pedido web ${order.code}`);

    const after = await server()
      .post("/api/v1/orders/availability")
      .send({ items: [{ productId: ids.whey, quantity: 2 }] });
    const pickup = data<AvailabilityBody>(after).branches.find(
      (branch) => branch.branchId === ids.pickup,
    );
    expect(pickup?.items[0].available).toBe(1);
  });

  it("keeps the POS from selling the held units", async () => {
    const response = await server()
      .post("/api/v1/sales")
      .set(auth("SUPERADMIN"))
      .send({
        branchId: ids.pickup,
        items: [{ productId: ids.whey, quantity: 2 }],
        promotionId: null,
        payments: [{ paymentMethodId: ids.cash, amount: "300000.00" }],
      });

    expect(response.status).toBe(422);
    expect((response.body as { error: { code: string } }).error.code).toBe(
      "INSUFFICIENT_STOCK",
    );
  });

  it("sends a delivery from the delivery branch that has the whole cart", async () => {
    const response = await placeOrder({
      fulfillment: "DELIVERY",
      items: [
        { productId: ids.whey, quantity: 2 },
        { productId: ids.creatine, quantity: 1 },
      ],
      customer: customer({ phone: "310 233 2100" }),
      delivery: { address: "Calle 19 # 9-35", neighborhood: "Centro" },
    });

    expect(response.status).toBe(201);
    expect(data<OrderBody>(response).branch.id).toBe(ids.delivery);

    const tooMuch = await placeOrder({
      fulfillment: "DELIVERY",
      items: [{ productId: ids.creatine, quantity: 20 }],
      customer: customer(),
      delivery: { address: "Calle 19 # 9-35", neighborhood: "Centro" },
    });
    expect(tooMuch.status).toBe(422);
    expect((tooMuch.body as { error: { code: string } }).error.code).toBe(
      "INSUFFICIENT_STOCK",
    );
  });

  it("registers the buyer once and links later orders by document", async () => {
    const registered = customer({
      register: true,
      documentTypeId: ids.documentType,
      documentNumber: `9${runId}`.slice(0, 20),
      email: `comprador.${runId}@e2e.test`,
    });
    const first = await placeOrder({
      fulfillment: "PICKUP",
      branchId: ids.delivery,
      items: [{ productId: ids.creatine, quantity: 1 }],
      customer: registered,
    });
    const second = await placeOrder({
      fulfillment: "PICKUP",
      branchId: ids.delivery,
      items: [{ productId: ids.whey, quantity: 1 }],
      customer: registered,
    });

    expect(first.status).toBe(201);
    const firstCustomer = data<OrderBody>(first).customer;
    expect(firstCustomer.registered).toBe(true);
    expect(data<OrderBody>(second).customer.id).toBe(firstCustomer.id);

    const conflict = await placeOrder({
      fulfillment: "PICKUP",
      branchId: ids.delivery,
      items: [{ productId: ids.whey, quantity: 1 }],
      customer: { ...registered, documentNumber: `8${runId}`.slice(0, 20) },
    });
    expect(conflict.status).toBe(409);
  });

  it.each([
    [{ customer: customer({ phone: "12345" }) }],
    [{ customer: customer({ register: true }) }],
    [{ fulfillment: "DELIVERY", branchId: undefined }],
    [{ items: [] }],
  ])("rejects an invalid order (%#)", async (overrides) => {
    const response = await placeOrder({
      fulfillment: "PICKUP",
      branchId: ids.pickup,
      items: [{ productId: ids.whey, quantity: 1 }],
      customer: customer(),
      ...overrides,
    });

    expect(response.status).toBe(400);
  });

  it("lists the orders by role and status", async () => {
    const leader = await server()
      .get(`/api/v1/orders?limit=100`)
      .set(auth("BRANCH_LEADER"));
    expect(leader.status).toBe(200);
    const leaderOrders = (leader.body as { data: OrderBody[] }).data;
    expect(leaderOrders.length).toBeGreaterThan(0);
    expect(leaderOrders.every((order) => order.branch.id === ids.pickup)).toBe(
      true,
    );

    const forbidden = await server()
      .get(`/api/v1/orders?branchId=${ids.delivery}`)
      .set(auth("BRANCH_LEADER"));
    expect(forbidden.status).toBe(403);

    const admin = await server()
      .get(`/api/v1/orders?branchId=${ids.delivery}&status=PENDING`)
      .set(auth("SUPERADMIN"));
    const body = admin.body as {
      data: OrderBody[];
      meta: { openOrders: number };
    };
    expect(body.data.length).toBe(3);
    expect(body.meta.openOrders).toBe(3);

    expect((await server().get("/api/v1/orders").set(auth("DEV"))).status).toBe(
      403,
    );
    expect((await server().get("/api/v1/orders")).status).toBe(401);
  });

  it("moves a pickup order through its statuses and completes the purchase", async () => {
    const id = created[0];
    const move = (status: string, extra: object = {}) =>
      server()
        .patch(`/api/v1/orders/${id}/status`)
        .set(auth("BRANCH_LEADER"))
        .send({ status, ...extra });

    expect((await move("CONFIRMED")).status).toBe(200);
    const wrong = await move("OUT_FOR_DELIVERY");
    expect(wrong.status).toBe(409);
    expect((wrong.body as { error: { code: string } }).error.code).toBe(
      "INVALID_STATUS_TRANSITION",
    );
    expect(data<OrderBody>(await move("READY")).status).toBe("READY");

    const complete = await server()
      .post(`/api/v1/orders/${id}/complete`)
      .set(auth("BRANCH_LEADER"))
      .send({ paymentMethodId: ids.cash, reference: "Pago en caja" });

    expect(complete.status).toBe(200);
    const result = data<{
      order: OrderBody;
      sale: { id: string; total: string; items: unknown[] };
    }>(complete);
    expect(result.order.status).toBe("DELIVERED");
    expect(result.order.sale?.id).toBe(result.sale.id);
    expect(result.sale.total).toBe("450000.00");
    const stock = await prisma.branchInventory.aggregate({
      where: { branchId: ids.pickup, productId: ids.whey },
      _sum: { quantity: true },
    });
    expect(stock._sum.quantity).toBe(1);

    const again = await server()
      .post(`/api/v1/orders/${id}/complete`)
      .set(auth("BRANCH_LEADER"))
      .send({ paymentMethodId: ids.cash });
    expect(again.status).toBe(409);
  });

  it("asks for a reason to cancel and releases the units", async () => {
    const id = created[1];
    const noReason = await server()
      .patch(`/api/v1/orders/${id}/status`)
      .set(auth("SUPERADMIN"))
      .send({ status: "CANCELLED" });
    expect(noReason.status).toBe(400);

    const cancelled = await server()
      .patch(`/api/v1/orders/${id}/status`)
      .set(auth("SUPERADMIN"))
      .send({ status: "CANCELLED", reason: "El cliente no respondió" });
    expect(data<OrderBody>(cancelled).status).toBe("CANCELLED");
    const audit = await prisma.auditLog.findFirst({
      where: { entity: "ONLINE_ORDER", entityId: id, action: "CANCEL" },
    });
    expect(audit).not.toBeNull();
  });

  it("expires the holds after 48 hours", async () => {
    const id = created[2];
    await prisma.onlineOrder.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const detail = await server()
      .get(`/api/v1/orders/${id}`)
      .set(auth("SUPERADMIN"));
    expect(data<OrderBody>(detail).status).toBe("EXPIRED");
    const complete = await server()
      .post(`/api/v1/orders/${id}/complete`)
      .set(auth("SUPERADMIN"))
      .send({ paymentMethodId: ids.cash });
    expect((complete.body as { error: { code: string } }).error.code).toBe(
      "ORDER_EXPIRED",
    );

    expect(
      await app.get(OnlineOrdersService).expirePendingOrders(),
    ).toBeGreaterThanOrEqual(1);
    const row = await prisma.onlineOrder.findUnique({
      where: { id },
      select: { status: true },
    });
    expect(row?.status).toBe("EXPIRED");
  });

  it("lists the document types for the registration without a token", async () => {
    const response = await server().get("/api/v1/orders/document-types");

    expect(response.status).toBe(200);
    expect(data<{ id: string }[]>(response).map((item) => item.id)).toContain(
      ids.documentType,
    );
  });
});
