import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

type Role = "SUPERADMIN" | "BRANCH_LEADER" | "BRANCH_ASSISTANT";

interface PurchaseBody {
  id: string;
  purchaseNumber: string;
  status: string;
  total: string;
  supplier: { id: string; name: string };
  items: {
    id: string;
    supply: { id: string; name: string; unit: string };
    requestedQuantity: number;
    receivedQuantity: number;
    pendingQuantity: number;
    unitCost: string;
    subtotal: string;
  }[];
}

const runId = Date.now().toString(36);
const DOCUMENT_CODE = `CC-SPU-${runId}`.slice(0, 20);
const data = <T>(response: request.Response) =>
  (response.body as { data: T }).data;
const errorCode = (response: request.Response) =>
  (response.body as { error: { code: string } }).error.code;

describe("Supply purchases (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const tokens = {} as Record<Role, string>;
  const personIds: string[] = [];
  const ids = {
    documentType: "",
    supplier: "",
    unit: "",
    milk: "",
    protein: "",
    branch: "",
    otherBranch: "",
    purchase: "",
  };
  const auth = (role: Role) => ({ Authorization: `Bearer ${tokens[role]}` });
  const server = () => request(app.getHttpServer());

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
        data: { code: DOCUMENT_CODE, name: "Documento (e2e compras insumos)" },
      })
    ).id;
    const person = (index: number, label: string) =>
      prisma.person.create({
        data: {
          documentTypeId: ids.documentType,
          documentNumber: `${runId}${index}`,
          firstName: label,
          lastName: "Compras insumos",
          email: `${label.toLowerCase()}.spu.${runId}@e2e.test`,
          phone: "3000000000",
          address: "Calle 1",
        },
      });
    const supplierPerson = await person(9, "Proveedor");
    personIds.push(supplierPerson.id);
    ids.supplier = (
      await prisma.supplier.create({
        data: {
          personId: supplierPerson.id,
          commercialName: `Lácteos ${runId}`,
        },
      })
    ).personId;
    ids.branch = (
      await prisma.branch.create({
        data: { name: `${runId} Sede compras`, address: "Calle 1", phone: "1" },
      })
    ).id;
    ids.otherBranch = (
      await prisma.branch.create({
        data: {
          name: `${runId} Otra sede compras`,
          address: "Calle 2",
          phone: "2",
        },
      })
    ).id;
    ids.unit = (
      await prisma.unitMeasure.create({
        data: {
          name: `${runId} Mililitro`,
          abreviation: `M${runId.slice(-8)}`,
        },
      })
    ).id;
    ids.milk = (
      await prisma.supply.create({
        data: { name: `${runId} Leche`, unitOfMeasureId: ids.unit },
      })
    ).id;
    ids.protein = (
      await prisma.supply.create({
        data: { name: `${runId} Proteína granel`, unitOfMeasureId: ids.unit },
      })
    ).id;

    const jwt = app.get(JwtService);
    for (const [index, roleName] of (
      ["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const
    ).entries()) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: { active: true },
        create: { name: roleName },
      });
      const created = await person(index, roleName);
      await prisma.userAccount.create({
        data: {
          personId: created.id,
          roleId: role.id,
          active: true,
          mustChangePassword: false,
        },
      });
      personIds.push(created.id);
      tokens[roleName] = await jwt.signAsync({ sub: created.id });
      if (roleName !== "SUPERADMIN") {
        await prisma.userBranch.create({
          data: {
            userId: created.id,
            branchId: ids.branch,
            assignmentDate: new Date(),
          },
        });
      }
    }
  }, 60000);

  afterAll(async () => {
    if (!prisma) return;
    const supplyIds = [ids.milk, ids.protein];
    await prisma.supplyPurchase.deleteMany({
      where: { supplierId: ids.supplier },
    });
    await prisma.supplyStockMovement.deleteMany({
      where: { supplyId: { in: supplyIds } },
    });
    await prisma.supplyStock.deleteMany({
      where: { supplyId: { in: supplyIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { entity: "SUPPLY_PURCHASE", userId: { in: personIds } },
    });
    await prisma.supply.deleteMany({ where: { id: { in: supplyIds } } });
    await prisma.unitMeasure.deleteMany({ where: { id: ids.unit } });
    await prisma.userBranch.deleteMany({
      where: { userId: { in: personIds } },
    });
    await prisma.userAccount.deleteMany({
      where: { personId: { in: personIds } },
    });
    await prisma.supplier.deleteMany({ where: { personId: ids.supplier } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.branch.deleteMany({
      where: { id: { in: [ids.branch, ids.otherBranch] } },
    });
    await prisma.documentType.deleteMany({ where: { id: ids.documentType } });
    await app.close();
  }, 60000);

  it("registers a purchase of supplies with quantities and costs", async () => {
    const response = await server()
      .post("/api/v1/supply-purchases")
      .set(auth("BRANCH_LEADER"))
      .send({
        supplierId: ids.supplier,
        observation: "Pedido semanal",
        items: [
          { supplyId: ids.milk, quantity: 5000.5, unitCost: "4.20" },
          { supplyId: ids.protein, quantity: 2000, unitCost: "95.00" },
        ],
      });

    expect(response.status).toBe(201);
    const purchase = data<PurchaseBody>(response);
    ids.purchase = purchase.id;
    expect(purchase.purchaseNumber).toMatch(/^CI-\d{8}-\d{4}$/);
    expect(purchase).toMatchObject({
      status: "PENDING_RECEIPT",
      total: "211002.10",
      supplier: { id: ids.supplier, name: `Lácteos ${runId}` },
    });
    const milk = purchase.items.find((item) => item.supply.id === ids.milk);
    expect(milk).toMatchObject({
      requestedQuantity: 5000.5,
      receivedQuantity: 0,
      pendingQuantity: 5000.5,
      subtotal: "21002.10",
    });
  });

  it("receives part of the purchase into a branch and adds it to the supply stock", async () => {
    const purchase = data<PurchaseBody>(
      await server()
        .get(`/api/v1/supply-purchases/${ids.purchase}`)
        .set(auth("SUPERADMIN")),
    );
    const milk = purchase.items.find((item) => item.supply.id === ids.milk)!;

    const response = await server()
      .post(`/api/v1/supply-purchases/${ids.purchase}/receipts`)
      .set(auth("BRANCH_LEADER"))
      .send({
        branchId: ids.branch,
        items: [{ detailId: milk.id, quantity: 3000 }],
      });

    expect(response.status).toBe(200);
    const after = data<PurchaseBody>(response);
    expect(after.status).toBe("PARTIALLY_RECEIVED");
    expect(
      after.items.find((item) => item.id === milk.id)?.pendingQuantity,
    ).toBe(2000.5);
    const stock = await prisma.supplyStock.findUnique({
      where: {
        branchId_supplyId: { branchId: ids.branch, supplyId: ids.milk },
      },
    });
    expect(Number(stock?.quantity)).toBe(3000);
    const movement = await prisma.supplyStockMovement.findFirst({
      where: { supplyId: ids.milk, branchId: ids.branch },
    });
    expect(movement).toMatchObject({ movementType: "ENTRY" });
    expect(movement?.observation).toBe(`Compra ${after.purchaseNumber}`);
  });

  it("rejects receiving more than what is pending and branches outside the leader", async () => {
    const purchase = data<PurchaseBody>(
      await server()
        .get(`/api/v1/supply-purchases/${ids.purchase}`)
        .set(auth("SUPERADMIN")),
    );
    const milk = purchase.items.find((item) => item.supply.id === ids.milk)!;

    const tooMuch = await server()
      .post(`/api/v1/supply-purchases/${ids.purchase}/receipts`)
      .set(auth("SUPERADMIN"))
      .send({
        branchId: ids.branch,
        items: [{ detailId: milk.id, quantity: 5000 }],
      });
    expect(tooMuch.status).toBe(422);
    expect(errorCode(tooMuch)).toBe("QUANTITY_EXCEEDS_PENDING");

    const otherBranch = await server()
      .post(`/api/v1/supply-purchases/${ids.purchase}/receipts`)
      .set(auth("BRANCH_LEADER"))
      .send({
        branchId: ids.otherBranch,
        items: [{ detailId: milk.id, quantity: 1 }],
      });
    expect(otherBranch.status).toBe(403);
  });

  it("completes the purchase and blocks a new receipt", async () => {
    const purchase = data<PurchaseBody>(
      await server()
        .get(`/api/v1/supply-purchases/${ids.purchase}`)
        .set(auth("SUPERADMIN")),
    );

    const response = await server()
      .post(`/api/v1/supply-purchases/${ids.purchase}/receipts`)
      .set(auth("SUPERADMIN"))
      .send({
        branchId: ids.otherBranch,
        items: purchase.items.map((item) => ({
          detailId: item.id,
          quantity: item.pendingQuantity,
        })),
      });

    expect(data<PurchaseBody>(response).status).toBe("FULLY_RECEIVED");
    const protein = await prisma.supplyStock.findUnique({
      where: {
        branchId_supplyId: { branchId: ids.otherBranch, supplyId: ids.protein },
      },
    });
    expect(Number(protein?.quantity)).toBe(2000);

    const again = await server()
      .post(`/api/v1/supply-purchases/${ids.purchase}/receipts`)
      .set(auth("SUPERADMIN"))
      .send({
        branchId: ids.branch,
        items: [{ detailId: purchase.items[0].id, quantity: 1 }],
      });
    expect(again.status).toBe(409);
  });

  it("lists the purchases and rejects invalid ones", async () => {
    const list = await server()
      .get(`/api/v1/supply-purchases?supplierId=${ids.supplier}`)
      .set(auth("BRANCH_LEADER"));
    expect((list.body as { data: PurchaseBody[] }).data).toHaveLength(1);

    const duplicated = await server()
      .post("/api/v1/supply-purchases")
      .set(auth("SUPERADMIN"))
      .send({
        supplierId: ids.supplier,
        items: [
          { supplyId: ids.milk, quantity: 1, unitCost: "1.00" },
          { supplyId: ids.milk, quantity: 2, unitCost: "1.00" },
        ],
      });
    expect(errorCode(duplicated)).toBe("DUPLICATED_SUPPLY");

    const invalid = await server()
      .post("/api/v1/supply-purchases")
      .set(auth("SUPERADMIN"))
      .send({
        supplierId: ids.supplier,
        items: [{ supplyId: ids.milk, quantity: 0, unitCost: "1" }],
      });
    expect(invalid.status).toBe(400);

    const assistant = await server()
      .get("/api/v1/supply-purchases")
      .set(auth("BRANCH_ASSISTANT"));
    expect(assistant.status).toBe(403);
  });
});
