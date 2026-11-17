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
const DOCUMENT_CODE = `CC-SCV-${runId}`.slice(0, 20);
const errorCode = (response: request.Response) =>
  (response.body as { error: { code: string } }).error.code;

describe("Product to supply conversion (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = "";
  let leaderToken = "";
  const personIds: string[] = [];
  const ids = {
    documentType: "",
    branch: "",
    otherBranch: "",
    category: "",
    unit: "",
    gram: "",
    product: "",
    jar: "",
    prepared: "",
    recipe: "",
    supply: "",
    plainSupply: "",
    createdSupply: "",
  };
  let superadminId = "";
  const server = () => request(app.getHttpServer());
  const convert = (body: object, bearer = token) =>
    server()
      .post("/api/v1/supply-stock/conversions")
      .set("Authorization", `Bearer ${bearer}`)
      .send(body);

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
        data: { code: DOCUMENT_CODE, name: "Documento (e2e conversión)" },
      })
    ).id;
    ids.branch = (
      await prisma.branch.create({
        data: {
          name: `${runId} Sede conversión`,
          address: "Calle 1",
          phone: "1",
        },
      })
    ).id;
    ids.otherBranch = (
      await prisma.branch.create({
        data: {
          name: `${runId} Otra conversión`,
          address: "Calle 2",
          phone: "2",
        },
      })
    ).id;
    ids.category = (
      await prisma.category.create({
        data: { name: `${runId} Cat conversión` },
      })
    ).id;
    ids.unit = (
      await prisma.unitMeasure.create({
        data: {
          name: `${runId} Unidad conv`,
          abreviation: `U${runId.slice(-8)}`,
        },
      })
    ).id;
    ids.gram = (
      await prisma.unitMeasure.create({
        data: {
          name: `${runId} Gramo conv`,
          abreviation: `G${runId.slice(-8)}`,
        },
      })
    ).id;
    ids.product = (
      await prisma.product.create({
        data: {
          name: `${runId} Whey 2 lb`,
          referenceCode: `CNV-${runId}`,
          categoryId: ids.category,
          unitOfMeasureId: ids.unit,
          price: "150000.00",
        },
      })
    ).id;
    ids.jar = (
      await prisma.product.create({
        data: {
          name: `${runId} Colágeno 300 g`,
          referenceCode: `CNJ-${runId}`,
          categoryId: ids.category,
          unitOfMeasureId: ids.unit,
          price: "80000.00",
        },
      })
    ).id;
    ids.prepared = (
      await prisma.product.create({
        data: {
          name: `${runId} Batido preparado`,
          referenceCode: `CNP-${runId}`,
          categoryId: ids.category,
          unitOfMeasureId: ids.unit,
          price: "12000.00",
        },
      })
    ).id;
    await prisma.branchInventory.createMany({
      data: [
        {
          branchId: ids.branch,
          productId: ids.product,
          quantity: 1,
          expirationDate: new Date("2028-01-01T00:00:00.000Z"),
        },
        {
          branchId: ids.branch,
          productId: ids.product,
          quantity: 2,
          expirationDate: new Date("2029-01-01T00:00:00.000Z"),
        },
      ],
    });
    ids.supply = (
      await prisma.supply.create({
        data: {
          name: `${runId} Proteína porcionada`,
          unitOfMeasureId: ids.gram,
        },
      })
    ).id;
    ids.plainSupply = (
      await prisma.supply.create({
        data: { name: `${runId} Leche conversión`, unitOfMeasureId: ids.gram },
      })
    ).id;

    const jwt = app.get(JwtService);
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
          documentTypeId: ids.documentType,
          documentNumber: `${runId}${index}`,
          firstName: roleName,
          lastName: "Conversión",
          email: `${roleName.toLowerCase()}.conv.${runId}@e2e.test`,
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
      const signed = await jwt.signAsync({ sub: person.id });
      if (roleName === "SUPERADMIN") {
        token = signed;
        superadminId = person.id;
      } else {
        leaderToken = signed;
        await prisma.userBranch.create({
          data: {
            userId: person.id,
            branchId: ids.otherBranch,
            assignmentDate: new Date(),
          },
        });
      }
    }
    ids.recipe = (
      await prisma.recipe.create({
        data: {
          name: `${runId} Receta batido`,
          productId: ids.prepared,
          createdById: superadminId,
          ingredients: {
            create: [
              {
                supplyId: ids.plainSupply,
                quantity: 200,
                unitOfMeasureId: ids.gram,
              },
            ],
          },
        },
      })
    ).id;
  }, 60000);

  afterAll(async () => {
    if (!prisma) return;
    const supplyIds = [ids.supply, ids.plainSupply, ids.createdSupply].filter(
      Boolean,
    );
    const productIds = [ids.product, ids.jar, ids.prepared];
    await prisma.recipe.deleteMany({
      where: { name: { startsWith: runId } },
    });
    await prisma.supplyStockMovement.deleteMany({
      where: { supplyId: { in: supplyIds } },
    });
    await prisma.supplyStock.deleteMany({
      where: { supplyId: { in: supplyIds } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { productId: ids.product },
    });
    await prisma.notification.deleteMany({ where: { productId: ids.product } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...supplyIds, ...productIds] } },
    });
    await prisma.supply.deleteMany({ where: { id: { in: supplyIds } } });
    await prisma.branchInventory.deleteMany({
      where: { productId: ids.product },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { id: ids.category } });
    await prisma.unitMeasure.deleteMany({
      where: { id: { in: [ids.unit, ids.gram] } },
    });
    await prisma.userBranch.deleteMany({
      where: { userId: { in: personIds } },
    });
    await prisma.userAccount.deleteMany({
      where: { personId: { in: personIds } },
    });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.branch.deleteMany({
      where: { id: { in: [ids.branch, ids.otherBranch] } },
    });
    await prisma.documentType.deleteMany({ where: { id: ids.documentType } });
    await app.close();
  }, 60000);

  it("links a supply to a product, which gives it its name", async () => {
    const response = await server()
      .patch(`/api/v1/supplies/${ids.supply}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceProductId: ids.product, productUnitQuantity: 907 });

    expect(response.status).toBe(200);
    expect((response.body as { data: unknown }).data).toMatchObject({
      name: `${runId} Whey 2 lb`,
      productUnitQuantity: 907,
      sourceProduct: { id: ids.product, name: `${runId} Whey 2 lb` },
    });
  });

  it("opens product units earliest expiration first and adds the supply", async () => {
    const response = await convert({
      branchId: ids.branch,
      supplyId: ids.supply,
      productUnits: 2,
      observation: "Batidos de la tarde",
    });

    expect(response.status).toBe(201);
    expect((response.body as { data: unknown }).data).toMatchObject({
      productUnits: 2,
      supplyQuantity: 1814,
      resultingSupplyQuantity: 1814,
      remainingProductUnits: 1,
    });
    const lots = await prisma.branchInventory.findMany({
      where: { branchId: ids.branch, productId: ids.product },
      orderBy: { expirationDate: "asc" },
      select: { quantity: true },
    });
    expect(lots.map((lot) => lot.quantity)).toEqual([0, 1]);
    const exits = await prisma.inventoryMovement.findMany({
      where: { productId: ids.product, movementType: "EXIT" },
    });
    expect(exits.map((exit) => exit.quantity).sort()).toEqual([1, 1]);
    expect(exits[0].observation).toBe(
      `Conversión a insumo ${runId} Whey 2 lb · Batidos de la tarde`,
    );
    const entry = await prisma.supplyStockMovement.findFirst({
      where: { supplyId: ids.supply, movementType: "ENTRY" },
    });
    expect(Number(entry?.quantity)).toBe(1814);
  });

  it("does not open more units than the branch has", async () => {
    const response = await convert({
      branchId: ids.branch,
      supplyId: ids.supply,
      productUnits: 2,
    });

    expect(response.status).toBe(422);
    expect(errorCode(response)).toBe("INSUFFICIENT_STOCK");
  });

  it("asks for a linked supply and keeps branch roles in their branches", async () => {
    const unlinked = await convert({
      branchId: ids.branch,
      supplyId: ids.plainSupply,
      productUnits: 1,
    });
    expect(errorCode(unlinked)).toBe("SUPPLY_NOT_LINKED");

    const outside = await convert(
      { branchId: ids.branch, supplyId: ids.supply, productUnits: 1 },
      leaderToken,
    );
    expect(outside.status).toBe(403);
  });

  it("removes the link with null", async () => {
    const response = await server()
      .patch(`/api/v1/supplies/${ids.plainSupply}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceProductId: null });

    expect(response.status).toBe(200);
    expect((response.body as { data: unknown }).data).toMatchObject({
      sourceProduct: null,
      productUnitQuantity: null,
    });
  });

  it("creates a supply from a product with the product name", async () => {
    const response = await server()
      .post("/api/v1/supplies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        unitOfMeasureId: ids.gram,
        sourceProductId: ids.jar,
        productUnitQuantity: 300,
      });

    expect(response.status).toBe(201);
    const data = (response.body as { data: { id: string } }).data;
    ids.createdSupply = data.id;
    expect(data).toMatchObject({
      name: `${runId} Colágeno 300 g`,
      productUnitQuantity: 300,
      sourceProduct: { id: ids.jar },
    });
  });

  it("feeds a single supply from each product", async () => {
    const response = await server()
      .patch(`/api/v1/supplies/${ids.plainSupply}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ sourceProductId: ids.jar, productUnitQuantity: 300 });

    expect(response.status).toBe(409);
    expect(errorCode(response)).toBe("PRODUCT_ALREADY_LINKED");
    expect(
      (response.body as { error: { details: unknown } }).error.details,
    ).toMatchObject({
      supplyId: ids.createdSupply,
      supplyName: `${runId} Colágeno 300 g`,
    });
  });

  it("keeps the supply name in step with the product", async () => {
    const rename = await server()
      .patch(`/api/v1/supplies/${ids.createdSupply}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Maní" });
    expect(rename.status).toBe(422);
    expect(errorCode(rename)).toBe("SUPPLY_NAME_FROM_PRODUCT");

    const product = await server()
      .patch(`/api/v1/products/${ids.jar}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `${runId} Colágeno hidrolizado 300 g` });
    expect(product.status).toBe(200);

    const supply = await prisma.supply.findUnique({
      where: { id: ids.createdSupply },
      select: { name: true },
    });
    expect(supply?.name).toBe(`${runId} Colágeno hidrolizado 300 g`);
  });

  it("keeps prepared products and supply sources apart", async () => {
    const supply = await server()
      .post("/api/v1/supplies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        unitOfMeasureId: ids.gram,
        sourceProductId: ids.prepared,
        productUnitQuantity: 400,
      });
    expect(supply.status).toBe(422);
    expect(errorCode(supply)).toBe("PRODUCT_IS_PREPARED");

    const recipe = await server()
      .post("/api/v1/recipes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `${runId} Receta tarro`,
        productId: ids.jar,
        ingredients: [
          {
            supplyId: ids.plainSupply,
            quantity: 100,
            unitOfMeasureId: ids.gram,
          },
        ],
      });
    expect(recipe.status).toBe(422);
    expect(errorCode(recipe)).toBe("PRODUCT_IS_SUPPLY_SOURCE");
  });
});
