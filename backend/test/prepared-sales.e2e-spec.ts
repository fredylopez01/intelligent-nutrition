import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

const runId = Date.now().toString(36);
const DOCUMENT_CODE = `CC-PRP-${runId}`.slice(0, 20);
const errorCode = (response: request.Response) =>
  (response.body as { error: { code: string } }).error.code;

interface SellableRow {
  productId: string;
  availableQuantity: number;
  prepared: boolean;
  recipeId: string | null;
}

describe("Prepared products sold from recipes (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = "";
  const personIds: string[] = [];
  const ids = {
    documentType: "",
    branch: "",
    category: "",
    unit: "",
    gram: "",
    product: "",
    otherProduct: "",
    whey: "",
    milk: "",
    recipe: "",
    payment: "",
    sale: "",
  };
  const server = () => request(app.getHttpServer());
  const auth = (call: request.Test) =>
    call.set("Authorization", `Bearer ${token}`);
  const sell = (quantity: number, extra: object = {}) =>
    auth(server().post("/api/v1/sales")).send({
      branchId: ids.branch,
      customerId: null,
      promotionId: null,
      items: [{ productId: ids.product, quantity, ...extra }],
      payments: [
        { paymentMethodId: ids.payment, amount: (quantity * 12000).toFixed(2) },
      ],
    });
  const stockOf = async (supplyId: string) =>
    Number(
      (
        await prisma.supplyStock.findUniqueOrThrow({
          where: { branchId_supplyId: { branchId: ids.branch, supplyId } },
        })
      ).quantity,
    );
  const sellable = async () => {
    const response = await auth(
      server().get(`/api/v1/branches/${ids.branch}/sellable-products`),
    ).query({ page: 1, limit: 50, search: runId });
    return (response.body as { data: SellableRow[] }).data;
  };

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
        data: { code: DOCUMENT_CODE, name: "Documento (e2e preparados)" },
      })
    ).id;
    ids.branch = (
      await prisma.branch.create({
        data: { name: `${runId} Sede batidos`, address: "Calle 1", phone: "1" },
      })
    ).id;
    ids.category = (
      await prisma.category.create({ data: { name: `${runId} Bebidas` } })
    ).id;
    ids.unit = (
      await prisma.unitMeasure.create({
        data: {
          name: `${runId} Unidad prep`,
          abreviation: `U${runId.slice(-8)}`,
        },
      })
    ).id;
    ids.gram = (
      await prisma.unitMeasure.create({
        data: {
          name: `${runId} Gramo prep`,
          abreviation: `G${runId.slice(-8)}`,
        },
      })
    ).id;
    for (const [key, name] of [
      ["product", "Batido de proteína"],
      ["otherProduct", "Batido de avena"],
    ] as const) {
      ids[key] = (
        await prisma.product.create({
          data: {
            name: `${runId} ${name}`,
            referenceCode: `PRP-${key}-${runId}`.slice(0, 50),
            categoryId: ids.category,
            unitOfMeasureId: ids.unit,
            price: "12000.00",
          },
        })
      ).id;
    }
    ids.whey = (
      await prisma.supply.create({
        data: { name: `${runId} Proteína batido`, unitOfMeasureId: ids.gram },
      })
    ).id;
    ids.milk = (
      await prisma.supply.create({
        data: { name: `${runId} Leche batido`, unitOfMeasureId: ids.gram },
      })
    ).id;
    await prisma.supplyStock.createMany({
      data: [
        { branchId: ids.branch, supplyId: ids.whey, quantity: "100.000" },
        { branchId: ids.branch, supplyId: ids.milk, quantity: "1000.000" },
      ],
    });
    ids.payment = (
      await prisma.paymentMethod.create({
        data: { code: `PRP_${runId.toUpperCase()}`, name: `Efectivo ${runId}` },
      })
    ).id;

    const role = await prisma.role.upsert({
      where: { name: "SUPERADMIN" },
      update: { active: true },
      create: { name: "SUPERADMIN" },
    });
    const person = await prisma.person.create({
      data: {
        documentTypeId: ids.documentType,
        documentNumber: `${runId}0`,
        firstName: "Super",
        lastName: "Preparados",
        email: `superadmin.prep.${runId}@e2e.test`,
        phone: "3000000000",
        address: "Calle 1",
        userAccount: {
          create: { roleId: role.id, active: true, mustChangePassword: false },
        },
      },
    });
    personIds.push(person.id);
    token = await app.get(JwtService).signAsync({ sub: person.id });
  }, 60000);

  afterAll(async () => {
    if (!prisma) return;
    const supplyIds = [ids.whey, ids.milk];
    const productIds = [ids.product, ids.otherProduct];
    const sales = await prisma.sale.findMany({
      where: { branchId: ids.branch },
      select: { id: true },
    });
    const saleIds = sales.map(({ id }) => id);
    await prisma.supplyStockMovement.deleteMany({
      where: { supplyId: { in: supplyIds } },
    });
    await prisma.supplyStock.deleteMany({
      where: { supplyId: { in: supplyIds } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { saleId: { in: saleIds } },
    });
    await prisma.salePayment.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.saleDetail.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.recipe.deleteMany({ where: { id: ids.recipe } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: personIds } } });
    await prisma.supply.deleteMany({ where: { id: { in: supplyIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.paymentMethod.deleteMany({ where: { id: ids.payment } });
    await prisma.category.deleteMany({ where: { id: ids.category } });
    await prisma.unitMeasure.deleteMany({
      where: { id: { in: [ids.unit, ids.gram] } },
    });
    await prisma.userAccount.deleteMany({
      where: { personId: { in: personIds } },
    });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.branch.deleteMany({ where: { id: ids.branch } });
    await prisma.documentType.deleteMany({ where: { id: ids.documentType } });
    await app.close();
  }, 60000);

  it("links a recipe to the catalog product it prepares", async () => {
    const created = await auth(server().post("/api/v1/recipes")).send({
      name: `${runId} Batido de proteína`,
      productId: ids.product,
      ingredients: [
        { supplyId: ids.whey, quantity: 30, unitOfMeasureId: ids.gram },
        { supplyId: ids.milk, quantity: 250, unitOfMeasureId: ids.gram },
      ],
    });

    expect(created.status).toBe(201);
    const body = created.body as {
      data: { id: string; product: { id: string; price: string } | null };
    };
    ids.recipe = body.data.id;
    expect(body.data.product).toMatchObject({
      id: ids.product,
      price: "12000.00",
    });

    const duplicated = await auth(server().post("/api/v1/recipes")).send({
      name: `${runId} Otro batido`,
      productId: ids.product,
      ingredients: [
        { supplyId: ids.milk, quantity: 100, unitOfMeasureId: ids.gram },
      ],
    });
    expect(duplicated.status).toBe(409);
    expect(errorCode(duplicated)).toBe("PRODUCT_ALREADY_HAS_RECIPE");
  });

  it("offers the prepared product in the POS with what the supplies allow", async () => {
    const rows = await sellable();

    expect(rows.find((row) => row.productId === ids.product)).toMatchObject({
      availableQuantity: 3,
      prepared: true,
      recipeId: ids.recipe,
    });
    expect(
      rows.find((row) => row.productId === ids.otherProduct),
    ).toBeUndefined();
  });

  it("sells the prepared product and deducts every supply of the recipe", async () => {
    const response = await sell(2);

    expect(response.status).toBe(201);
    const sale = (
      response.body as {
        data: {
          id: string;
          saleNumber: string;
          items: Array<{ recipeId: string | null }>;
        };
      }
    ).data;
    ids.sale = sale.id;
    expect(sale.items[0].recipeId).toBe(ids.recipe);
    expect(await stockOf(ids.whey)).toBe(40);
    expect(await stockOf(ids.milk)).toBe(500);
    const movements = await prisma.supplyStockMovement.findMany({
      where: { saleId: sale.id },
      orderBy: { quantity: "asc" },
    });
    expect(
      movements.map((movement) => [
        movement.supplyId,
        movement.movementType,
        Number(movement.quantity),
        movement.observation,
      ]),
    ).toEqual([
      [ids.whey, "EXIT", 60, `Sale ${sale.saleNumber}`],
      [ids.milk, "EXIT", 500, `Sale ${sale.saleNumber}`],
    ]);
    expect(
      await prisma.inventoryMovement.count({ where: { saleId: sale.id } }),
    ).toBe(0);
    expect(
      (await sellable()).find((row) => row.productId === ids.product)
        ?.availableQuantity,
    ).toBe(1);
  });

  it("stops the sale with the missing supplies and changes nothing", async () => {
    const response = await sell(2);

    expect(response.status).toBe(422);
    expect(errorCode(response)).toBe("INSUFFICIENT_SUPPLY_STOCK");
    expect(
      (
        response.body as {
          error: { details: { items: Array<Record<string, unknown>> } };
        }
      ).error.details.items,
    ).toEqual([
      expect.objectContaining({
        supplyId: ids.whey,
        required: 60,
        available: 40,
      }),
    ]);
    expect(await stockOf(ids.whey)).toBe(40);
  });

  it("rejects the recipe of another product", async () => {
    const response = await auth(server().post("/api/v1/sales")).send({
      branchId: ids.branch,
      customerId: null,
      promotionId: null,
      items: [
        { productId: ids.otherProduct, quantity: 1, recipeId: ids.recipe },
      ],
      payments: [{ paymentMethodId: ids.payment, amount: "12000.00" }],
    });

    expect(response.status).toBe(422);
    expect(errorCode(response)).toBe("RECIPE_PRODUCT_MISMATCH");
  });

  it("gives the supplies back when the sale is reversed", async () => {
    const response = await auth(
      server().post(`/api/v1/sales/${ids.sale}/reverse`),
    ).send({ reason: "El cliente cambió de opinión" });

    expect(response.status).toBe(200);
    expect(await stockOf(ids.whey)).toBe(100);
    expect(await stockOf(ids.milk)).toBe(1000);
  });

  it("does not sell the product while its recipe is inactive", async () => {
    await prisma.recipe.update({
      where: { id: ids.recipe },
      data: { active: false },
    });

    const response = await sell(1);

    expect(response.status).toBe(422);
    expect(errorCode(response)).toBe("RECIPE_INACTIVE");
    expect(
      (await sellable()).find((row) => row.productId === ids.product),
    ).toBeUndefined();
  });
});
