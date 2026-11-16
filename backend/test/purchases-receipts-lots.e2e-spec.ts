import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

type RoleName = "SUPERADMIN" | "BRANCH_LEADER";

interface PurchaseBody {
  id: string;
  status: string;
  items: { id: string; receivedQuantity: number; received: boolean }[];
}

const runId = Date.now().toString(36);
const at = (value: string) => new Date(`${value}T00:00:00.000Z`);
const purchaseOf = (body: unknown) => (body as { data: PurchaseBody }).data;
const errorOf = (body: unknown) => (body as { error: { code: string } }).error;

describe("POST /api/v1/purchases/:purchaseId/receipts by lot (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let documentTypeId = "";
  let categoryId = "";
  let unitId = "";
  let productId = "";
  let generalProductId = "";
  let supplierId = "";
  let branchId = "";
  let purchaseId = "";
  let distributedPurchaseId = "";
  let detailId = "";
  const personIds: string[] = [];
  const tokens = {} as Record<RoleName, string>;

  const receive = (token: string, items: Record<string, unknown>[]) =>
    request(app.getHttpServer())
      .post(`/api/v1/purchases/${purchaseId}/receipts`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items });

  const generalLot = async (expirationDate: string) =>
    (
      await prisma.generalStock.findFirst({
        where: { productId, expirationDate: at(expirationDate) },
      })
    )?.quantity ?? null;

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
        data: { code: `CC-PRC-${runId}`, name: "NIT (e2e recepciones)" },
      })
    ).id;
    for (const [index, roleName] of (
      ["SUPERADMIN", "BRANCH_LEADER"] as const
    ).entries()) {
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
          email: `${roleName.toLowerCase()}.receipts.${runId}@e2e.test`,
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
    }
    supplierId = (
      await prisma.person.create({
        data: {
          documentTypeId,
          documentNumber: `${runId}S`,
          businessName: "Suplementos Andinos SAS",
          email: `supplier.receipts.${runId}@e2e.test`,
          phone: "3007776655",
          address: "Calle 5",
          supplier: { create: { commercialName: `Andinos ${runId}` } },
        },
      })
    ).id;
    categoryId = (
      await prisma.category.create({ data: { name: `${runId} Recepciones` } })
    ).id;
    unitId = (
      await prisma.unitMeasure.create({
        data: { name: `${runId} Unidad`, abreviation: `R${runId.slice(-8)}` },
      })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          name: `${runId} Whey`,
          referenceCode: `PRC-${runId}`,
          categoryId,
          unitOfMeasureId: unitId,
          price: "145000.00",
        },
      })
    ).id;
    generalProductId = (
      await prisma.product.create({
        data: {
          name: `${runId} BCAA`,
          referenceCode: `PRC-GEN-${runId}`.slice(0, 50),
          categoryId,
          unitOfMeasureId: unitId,
          price: "65000.00",
        },
      })
    ).id;
    branchId = (
      await prisma.branch.create({
        data: {
          name: `${runId} Sucursal`,
          address: "Calle 1",
          phone: "3000000000",
        },
      })
    ).id;
    await prisma.branchInventory.create({
      data: {
        branchId,
        productId,
        quantity: 0,
        minimumStock: 0,
        expirationDate: at("2027-01-31"),
      },
    });
    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber: `C-E2E-${runId}`,
        supplierId,
        userId: personIds[0],
        subtotal: "980000.00",
        total: "980000.00",
        details: {
          create: {
            productId,
            requestedQuantity: 10,
            receivedQuantity: 0,
            unitPrice: "98000.00",
            subtotal: "980000.00",
          },
        },
      },
      include: { details: true },
    });
    purchaseId = purchase.id;
    detailId = purchase.details[0].id;
  }, 30000);

  afterAll(async () => {
    try {
      const purchaseIds = [purchaseId, distributedPurchaseId].filter(Boolean);
      const productIds = [productId, generalProductId].filter(Boolean);
      await prisma?.inventoryMovement.deleteMany({
        where: { purchaseId: { in: purchaseIds } },
      });
      await prisma?.generalStock.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma?.branchInventory.deleteMany({
        where: { branchId, productId: { in: productIds } },
      });
      await prisma?.purchaseDetail.deleteMany({
        where: { purchaseId: { in: purchaseIds } },
      });
      await prisma?.purchase.deleteMany({
        where: { id: { in: purchaseIds } },
      });
      await prisma?.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: personIds } },
            { entityId: { in: purchaseIds } },
          ],
        },
      });
      await prisma?.product.deleteMany({
        where: { id: { in: productIds } },
      });
      await prisma?.branch.deleteMany({ where: { id: branchId } });
      await prisma?.category.deleteMany({ where: { id: categoryId } });
      await prisma?.unitMeasure.deleteMany({ where: { id: unitId } });
      await prisma?.supplier.deleteMany({ where: { personId: supplierId } });
      await prisma?.userAccount.deleteMany({
        where: { personId: { in: personIds } },
      });
      await prisma?.person.deleteMany({
        where: { id: { in: [...personIds, supplierId] } },
      });
      await prisma?.documentType.deleteMany({ where: { id: documentTypeId } });
    } finally {
      await app?.close();
    }
  }, 30000);

  it("does not let the branch leader confirm receipts", async () => {
    await receive(tokens.BRANCH_LEADER, [
      {
        purchaseDetailId: detailId,
        receivedQuantity: 1,
        expirationDate: "2027-06-30",
      },
    ]).expect(403);
  });

  it("requires the expiration date of each received lot", async () => {
    await receive(tokens.SUPERADMIN, [
      { purchaseDetailId: detailId, receivedQuantity: 1 },
    ]).expect(400);
  });

  it("rejects an expired lot", async () => {
    const response = await receive(tokens.SUPERADMIN, [
      {
        purchaseDetailId: detailId,
        receivedQuantity: 1,
        expirationDate: "2025-01-31",
      },
    ]).expect(422);

    expect(errorOf(response.body).code).toBe("LOT_EXPIRED");
  });

  it("receives part of the line in two lots into the general stock", async () => {
    const response = await receive(tokens.SUPERADMIN, [
      {
        purchaseDetailId: detailId,
        receivedQuantity: 4,
        expirationDate: "2027-03-31",
      },
      {
        purchaseDetailId: detailId,
        receivedQuantity: 2,
        expirationDate: "2027-09-30",
      },
    ]).expect(200);

    const purchase = purchaseOf(response.body);
    expect(purchase.status).toBe("PARTIALLY_RECEIVED");
    expect(purchase.items[0]).toMatchObject({
      receivedQuantity: 6,
      received: false,
    });
    expect(await generalLot("2027-03-31")).toBe(4);
    expect(await generalLot("2027-09-30")).toBe(2);
    const movements = await prisma.inventoryMovement.findMany({
      where: { purchaseId },
    });
    expect(movements).toHaveLength(2);
    expect(movements.every((movement) => movement.branchId === null)).toBe(
      true,
    );
  });

  it("rejects receiving more than requested", async () => {
    const response = await receive(tokens.SUPERADMIN, [
      {
        purchaseDetailId: detailId,
        receivedQuantity: 5,
        expirationDate: "2027-03-31",
      },
    ]).expect(422);

    expect(errorOf(response.body).code).toBe("RECEIVED_EXCEEDS_REQUESTED");
  });

  it("completes the purchase and then refuses more receipts", async () => {
    const response = await receive(tokens.SUPERADMIN, [
      {
        purchaseDetailId: detailId,
        receivedQuantity: 4,
        expirationDate: "2027-03-31",
      },
    ]).expect(200);

    expect(purchaseOf(response.body).status).toBe("FULLY_RECEIVED");
    expect(await generalLot("2027-03-31")).toBe(8);

    const again = await receive(tokens.SUPERADMIN, [
      {
        purchaseDetailId: detailId,
        receivedQuantity: 1,
        expirationDate: "2027-03-31",
      },
    ]).expect(409);
    expect(errorOf(again.body).code).toBe("PURCHASE_ALREADY_RECEIVED");
  });

  it("distributes received purchase lines between branch and general stock", async () => {
    const createdResponse = await request(app.getHttpServer())
      .post("/api/v1/purchases")
      .set("Authorization", `Bearer ${tokens.SUPERADMIN}`)
      .send({
        supplierId,
        items: [
          { productId, requestedQuantity: 4, unitPrice: "98000.00" },
          {
            productId: generalProductId,
            requestedQuantity: 6,
            unitPrice: "65000.00",
          },
        ],
      })
      .expect(201);
    const purchase = (
      createdResponse.body as {
        data: {
          id: string;
          items: Array<{ id: string; productId: string }>;
        };
      }
    ).data;
    distributedPurchaseId = purchase.id;
    expect(purchase.items).toHaveLength(2);

    const detailIdFor = (targetProductId: string) => {
      const detail = purchase.items.find(
        (item) => item.productId === targetProductId,
      );
      if (!detail)
        throw new Error(`Missing purchase line for ${targetProductId}`);
      return detail.id;
    };

    await request(app.getHttpServer())
      .post(`/api/v1/purchases/${purchase.id}/receipts`)
      .set("Authorization", `Bearer ${tokens.SUPERADMIN}`)
      .send({
        items: [
          {
            purchaseDetailId: detailIdFor(productId),
            receivedQuantity: 4,
            expirationDate: "2028-04-30",
            branchId,
          },
          {
            purchaseDetailId: detailIdFor(generalProductId),
            receivedQuantity: 6,
            expirationDate: "2028-04-30",
          },
        ],
      })
      .expect(200);

    expect(
      await prisma.branchInventory.findFirst({
        where: {
          branchId,
          productId,
          expirationDate: at("2028-04-30"),
        },
      }),
    ).toMatchObject({ quantity: 4 });
    expect(
      await prisma.generalStock.findFirst({
        where: { productId, expirationDate: at("2028-04-30") },
      }),
    ).toBeNull();
    expect(
      await prisma.generalStock.findFirst({
        where: {
          productId: generalProductId,
          expirationDate: at("2028-04-30"),
        },
      }),
    ).toMatchObject({ quantity: 6 });
    expect(
      await prisma.branchInventory.count({
        where: { branchId, productId: generalProductId },
      }),
    ).toBe(0);

    const movements = await prisma.inventoryMovement.findMany({
      where: { purchaseId: purchase.id },
    });
    expect(movements).toHaveLength(2);
    expect(movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId,
          branchId,
          quantity: 4,
          movementType: "ENTRY",
        }),
        expect.objectContaining({
          productId: generalProductId,
          branchId: null,
          quantity: 6,
          movementType: "ENTRY",
        }),
      ]),
    );
  });
});
