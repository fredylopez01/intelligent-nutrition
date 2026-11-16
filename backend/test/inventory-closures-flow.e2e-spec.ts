import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

type RoleName = "SUPERADMIN" | "BRANCH_LEADER" | "BRANCH_ASSISTANT";

interface ClosureItem {
  productId: string;
  expirationDate: string | null;
  physicalQuantity: number | null;
  systemQuantity?: number;
  difference?: number | null;
}

interface SupplyItem {
  supplyId: string;
  supplyName: string;
  unit: string;
  systemQuantity: string;
  physicalQuantity: string | null;
  observation: string | null;
  difference?: string | null;
}

interface ClosureBody {
  id: string;
  status: string;
  cashShiftId: string | null;
  countedItems: number;
  totalItems: number;
  totalDifferences?: number;
  totalSupplyDifferences?: number;
  countedSupplies: number;
  totalSupplies: number;
  items: ClosureItem[];
  supplyItems: SupplyItem[];
}

interface ErrorBody {
  error: { code: string; details?: Record<string, unknown> };
}

const runId = Date.now().toString(36);
const roleNames: RoleName[] = [
  "SUPERADMIN",
  "BRANCH_LEADER",
  "BRANCH_ASSISTANT",
];
const at = (value: string) => new Date(`${value}T00:00:00.000Z`);
const closureOf = (body: unknown) => (body as { data: ClosureBody }).data;
const errorOf = (body: unknown) => (body as ErrorBody).error;

describe("Inventory closure flow (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let documentTypeId = "";
  let categoryId = "";
  let unitId = "";
  let productId = "";
  let branchId = "";
  let closureId = "";
  let supplyId = "";
  let cashShiftId = "";
  let supplyItems: SupplyItem[] = [];
  const personIds: string[] = [];
  const tokens = {} as Record<RoleName, string>;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const getClosure = (token: string) =>
    http().get(`/api/v1/inventory-closures/${closureId}`).set(auth(token));
  const putCounts = (token: string, items: Record<string, unknown>[]) =>
    http()
      .put(`/api/v1/inventory-closures/${closureId}/counts`)
      .set(auth(token))
      .send({ items });
  const putSupplyCounts = (token: string, items: Record<string, unknown>[]) =>
    http()
      .put(`/api/v1/inventory-closures/${closureId}/counts`)
      .set(auth(token))
      .send({ supplyItems: items });
  const confirm = (token: string, body: Record<string, unknown> = {}) =>
    http()
      .post(`/api/v1/inventory-closures/${closureId}/confirm`)
      .set(auth(token))
      .send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);

    documentTypeId = (
      await prisma.documentType.create({
        data: { code: `CC-ICF-${runId}`, name: "Cédula (e2e flujo de cierre)" },
      })
    ).id;
    branchId = (
      await prisma.branch.create({
        data: {
          name: `${runId} Cierre`,
          address: "Calle 1",
          phone: "3001112233",
        },
      })
    ).id;
    for (const [index, roleName] of roleNames.entries()) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: { active: true },
        create: { name: roleName },
      });
      const person = await prisma.person.create({
        data: {
          documentTypeId,
          documentNumber: `${runId}${index}`,
          firstName: roleName,
          lastName: "E2E",
          email: `${roleName.toLowerCase()}.closureflow.${runId}@e2e.test`,
          phone: "3009998877",
          address: "Carrera 9 # 8-7",
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
      tokens[roleName] = await jwtService.signAsync({ sub: person.id });
      if (roleName !== "SUPERADMIN") {
        await prisma.userBranch.create({
          data: { userId: person.id, branchId, assignmentDate: new Date() },
        });
      }
    }
    categoryId = (
      await prisma.category.create({ data: { name: `${runId} Cierre cat` } })
    ).id;
    unitId = (
      await prisma.unitMeasure.create({
        data: { name: `${runId} Unidad`, abreviation: `F${runId.slice(-8)}` },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          name: `${runId} Whey`,
          referenceCode: `ICF-${runId}`,
          categoryId,
          unitOfMeasureId: unitId,
          price: "145000.00",
        },
      })
    ).id;
    await prisma.branchInventory.createMany({
      data: [
        {
          branchId,
          productId,
          quantity: 2,
          minimumStock: 1,
          expirationDate: at("2026-09-30"),
        },
        {
          branchId,
          productId,
          quantity: 8,
          minimumStock: 1,
          expirationDate: at("2027-06-30"),
        },
      ],
    });
    supplyId = (
      await prisma.supply.create({
        data: { name: `${runId} Leche cierre`, unitOfMeasureId: unitId },
      })
    ).id;
    await prisma.supplyStock.create({
      data: { branchId, supplyId, quantity: "500.000" },
    });
    cashShiftId = (
      await prisma.cashShift.create({
        data: {
          branchId,
          userId: personIds[1],
          openingAmount: "50000.00",
        },
      })
    ).id;
  }, 30000);

  afterAll(async () => {
    try {
      const closures = await prisma?.inventoryClosure.findMany({
        where: { branchId },
        select: { id: true },
      });
      const closureIds = (closures ?? []).map(({ id }) => id);
      await prisma?.inventoryClosureDetail.deleteMany({
        where: { closureId: { in: closureIds } },
      });
      await prisma?.auditLog.deleteMany({
        where: { userId: { in: personIds } },
      });
      await prisma?.inventoryClosureSupplyDetail.deleteMany({
        where: { closureId: { in: (closures ?? []).map(({ id }) => id) } },
      });
      await prisma?.inventoryClosure.deleteMany({ where: { branchId } });
      await prisma?.cashShift.deleteMany({ where: { branchId } });
      await prisma?.supplyStock.deleteMany({ where: { supplyId } });
      await prisma?.supply.deleteMany({ where: { id: supplyId } });
      await prisma?.inventoryMovement.deleteMany({ where: { productId } });
      await prisma?.notification.deleteMany({
        where: { OR: [{ productId }, { branchId }] },
      });
      await prisma?.branchInventory.deleteMany({ where: { productId } });
      await prisma?.userBranch.deleteMany({
        where: { userId: { in: personIds } },
      });
      await prisma?.product.deleteMany({ where: { id: productId } });
      await prisma?.category.deleteMany({ where: { id: categoryId } });
      await prisma?.unitMeasure.deleteMany({ where: { id: unitId } });
      await prisma?.userAccount.deleteMany({
        where: { personId: { in: personIds } },
      });
      await prisma?.person.deleteMany({ where: { id: { in: personIds } } });
      await prisma?.branch.deleteMany({ where: { id: branchId } });
      await prisma?.documentType.deleteMany({ where: { id: documentTypeId } });
    } finally {
      await app?.close();
    }
  }, 30000);

  it("the assistant starts the closure with the two lots to count", async () => {
    const response = await http()
      .post(`/api/v1/branches/${branchId}/inventory-closures`)
      .set(auth(tokens.BRANCH_ASSISTANT))
      .expect(201);

    const closure = closureOf(response.body);
    closureId = closure.id;
    supplyItems = closure.supplyItems;
    expect(closure.items.map((item) => item.expirationDate)).toEqual([
      "2026-09-30",
      "2027-06-30",
    ]);
    expect(closure.supplyItems).toContainEqual({
      supplyId,
      supplyName: `${runId} Leche cierre`,
      unit: `F${runId.slice(-8)}`,
      systemQuantity: "500",
      physicalQuantity: null,
      observation: null,
    });
    expect(closure.countedSupplies).toBe(0);
  });

  it("shows the open cash shift of the branch to the assistant", async () => {
    const response = await http()
      .get("/api/v1/cash-shifts/active")
      .query({ branchId })
      .set(auth(tokens.BRANCH_ASSISTANT))
      .expect(200);

    expect(
      (response.body as { data: { id: string; status: string } }).data,
    ).toMatchObject({ id: cashShiftId, status: "OPEN" });
  });

  it("saves a partial count and shows the expected quantity without differences while pending", async () => {
    const response = await putCounts(tokens.BRANCH_ASSISTANT, [
      { productId, expirationDate: "2027-06-30", physicalQuantity: 7 },
    ]).expect(200);

    expect(closureOf(response.body)).toMatchObject({
      countedItems: 1,
      totalItems: 2,
    });
    for (const token of [
      tokens.SUPERADMIN,
      tokens.BRANCH_LEADER,
      tokens.BRANCH_ASSISTANT,
    ]) {
      const detail = closureOf((await getClosure(token).expect(200)).body);
      expect(
        detail.items.every((item) => item.systemQuantity !== undefined),
      ).toBe(true);
      expect(JSON.stringify(detail)).not.toContain("difference");
      expect(detail).not.toHaveProperty("totalDifferences");
    }
  });

  it("does not confirm while a lot is missing its count", async () => {
    const response = await confirm(tokens.BRANCH_LEADER).expect(422);

    expect(errorOf(response.body)).toMatchObject({
      code: "INCOMPLETE_COUNT",
      details: { pending: [{ productId, expirationDate: "2026-09-30" }] },
    });
  });

  it("rejects a lot that is not part of the closure", async () => {
    const response = await putCounts(tokens.BRANCH_LEADER, [
      { productId, expirationDate: "2028-01-01", physicalQuantity: 1 },
    ]).expect(422);

    expect(errorOf(response.body).code).toBe("PRODUCT_NOT_IN_CLOSURE");
  });

  it("replaces a previous count", async () => {
    await putCounts(tokens.BRANCH_LEADER, [
      { productId, expirationDate: "2027-06-30", physicalQuantity: 8 },
      {
        productId,
        expirationDate: "2026-09-30",
        physicalQuantity: 1,
        observation: "Una caja rota",
      },
    ]).expect(200);

    const details = await prisma.inventoryClosureDetail.findMany({
      where: { closureId },
      orderBy: { expirationDate: "asc" },
      select: { physicalQuantity: true, observation: true },
    });
    expect(details).toEqual([
      { physicalQuantity: 1, observation: "Una caja rota" },
      { physicalQuantity: 8, observation: null },
    ]);
  });

  it("counts the supplies of the branch with decimals", async () => {
    const response = await putSupplyCounts(
      tokens.BRANCH_ASSISTANT,
      supplyItems.map((item) =>
        item.supplyId === supplyId
          ? { supplyId, physicalQuantity: 480.5, observation: "Derrame" }
          : {
              supplyId: item.supplyId,
              physicalQuantity: Number(item.systemQuantity),
            },
      ),
    ).expect(200);

    const closure = closureOf(response.body);
    expect(closure.countedSupplies).toBe(closure.totalSupplies);
    expect(
      closure.supplyItems.find((item) => item.supplyId === supplyId),
    ).toMatchObject({ physicalQuantity: "480.5", observation: "Derrame" });
    expect(JSON.stringify(closure)).not.toContain("difference");
  });

  it("lets the superadmin register counts", async () => {
    const response = await putCounts(tokens.SUPERADMIN, [
      { productId, expirationDate: "2027-06-30", physicalQuantity: 8 },
    ]).expect(200);

    expect(closureOf(response.body)).toMatchObject({
      countedItems: 2,
      totalItems: 2,
    });
  });

  it("the assistant confirms with the active cash shift without seeing the differences", async () => {
    const response = await confirm(tokens.BRANCH_ASSISTANT, {
      cashShiftId,
    }).expect(200);

    const closure = closureOf(response.body);
    expect(closure.status).toBe("CONFIRMED");
    expect(closure.cashShiftId).toBe(cashShiftId);
    expect(JSON.stringify(closure)).not.toContain("difference");
  });

  it("the leader sees the differences report after the confirmation", async () => {
    const closure = closureOf(
      (await getClosure(tokens.BRANCH_LEADER).expect(200)).body,
    );

    expect(closure.totalDifferences).toBe(1);
    expect(closure.totalSupplyDifferences).toBe(1);
    expect(
      closure.supplyItems.find((item) => item.supplyId === supplyId),
    ).toMatchObject({
      systemQuantity: "500",
      physicalQuantity: "480.5",
      difference: "-19.5",
    });
    expect(closure.items).toEqual([
      expect.objectContaining({
        expirationDate: "2026-09-30",
        systemQuantity: 2,
        physicalQuantity: 1,
        difference: -1,
      }),
      expect.objectContaining({
        expirationDate: "2027-06-30",
        systemQuantity: 8,
        physicalQuantity: 8,
        difference: 0,
      }),
    ]);
  });

  it("locks the counts after the confirmation", async () => {
    const response = await putCounts(tokens.BRANCH_LEADER, [
      { productId, expirationDate: "2027-06-30", physicalQuantity: 3 },
    ]).expect(422);

    expect(errorOf(response.body).code).toBe("CLOSURE_LOCKED");
  });

  it("blocks manual movements in the branch for the rest of the day", async () => {
    const response = await http()
      .post("/api/v1/inventory-movements")
      .set(auth(tokens.BRANCH_LEADER))
      .send({
        branchId,
        productId,
        movementType: "EXIT",
        quantity: 1,
        observation: "Producto dañado",
      })
      .expect(422);

    expect(errorOf(response.body).code).toBe("INVENTORY_CLOSED");
  });

  it("lists the closure with its summary and requires the branch for branch roles", async () => {
    await http()
      .get("/api/v1/inventory-closures")
      .set(auth(tokens.BRANCH_ASSISTANT))
      .expect(400);

    const response = await http()
      .get("/api/v1/inventory-closures")
      .query({ branchId, status: "CONFIRMED" })
      .set(auth(tokens.BRANCH_LEADER))
      .expect(200);
    const body = response.body as {
      data: Record<string, unknown>[];
      meta: { total: number };
    };
    expect(body.meta.total).toBe(1);
    expect(body.data[0]).toMatchObject({
      id: closureId,
      status: "CONFIRMED",
      userName: "BRANCH_ASSISTANT E2E",
      countedItems: 2,
      totalItems: 2,
      totalDifferences: 1,
    });
  });
});
