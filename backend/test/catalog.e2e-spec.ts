import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

interface CatalogItem {
  productId: string;
  name: string;
  price: string;
  imageUrl: string | null;
  branchUnits: number;
  availableInWarehouse: boolean;
  branches: { branchId: string; name: string; quantity: number }[];
  category: { id: string; name: string };
}

const runId = Date.now().toString(36);
const DAY_MS = 24 * 60 * 60 * 1000;
const future = new Date("2029-01-01T00:00:00.000Z");
const past = new Date(Date.now() - 10 * DAY_MS);
past.setUTCHours(0, 0, 0, 0);

describe("Public catalog (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ids = {
    branch: "",
    otherBranch: "",
    closedBranch: "",
    category: "",
    hiddenCategory: "",
    unit: "",
  };
  const products: Record<string, string> = {};

  const get = (path: string) =>
    request(app.getHttpServer()).get(`/api/v1/catalog${path}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const branch = (name: string, active = true) =>
      prisma.branch
        .create({
          data: {
            name: `${runId} ${name}`,
            address: "Calle",
            phone: "1",
            active,
          },
        })
        .then((created) => created.id);
    ids.branch = await branch("Centro catalogo");
    ids.otherBranch = await branch("Norte catalogo");
    ids.closedBranch = await branch("Cerrada catalogo", false);
    ids.category = (
      await prisma.category.create({ data: { name: `${runId} Proteína cat` } })
    ).id;
    ids.hiddenCategory = (
      await prisma.category.create({
        data: { name: `${runId} Oculta cat`, active: false },
      })
    ).id;
    ids.unit = (
      await prisma.unitMeasure.create({
        data: { name: `${runId} Und cat`, abreviation: `C${runId.slice(-8)}` },
      })
    ).id;

    const product = async (
      key: string,
      price: string,
      extra: { active?: boolean; categoryId?: string } = {},
    ) => {
      products[key] = (
        await prisma.product.create({
          data: {
            name: `${runId} ${key}`,
            referenceCode: `CAT-${key}-${runId}`,
            categoryId: extra.categoryId ?? ids.category,
            unitOfMeasureId: ids.unit,
            price,
            active: extra.active ?? true,
            description: `Descripción ${key}`,
          },
        })
      ).id;
    };
    await product("Sedes", "200000.00");
    await product("Bodega", "90000.00");
    await product("Vencido", "50000.00");
    await product("Inactivo", "60000.00", { active: false });
    await product("SedeCerrada", "70000.00");
    await product("CategoriaOculta", "80000.00", {
      categoryId: ids.hiddenCategory,
    });

    const lot = (
      branchId: string,
      key: string,
      quantity: number,
      date = future,
    ) => ({
      branchId,
      productId: products[key],
      quantity,
      expirationDate: date,
    });
    await prisma.branchInventory.createMany({
      data: [
        lot(ids.branch, "Sedes", 5),
        lot(ids.branch, "Sedes", 3, new Date("2030-01-01T00:00:00.000Z")),
        lot(ids.otherBranch, "Sedes", 2),
        lot(ids.otherBranch, "Bodega", 0),
        lot(ids.branch, "Vencido", 9, past),
        lot(ids.branch, "Inactivo", 4),
        lot(ids.closedBranch, "SedeCerrada", 6),
        lot(ids.branch, "CategoriaOculta", 6),
      ],
    });
    await prisma.generalStock.createMany({
      data: [
        { productId: products.Bodega, quantity: 40, expirationDate: future },
        { productId: products.Vencido, quantity: 10, expirationDate: past },
      ],
    });
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      const productIds = Object.values(products);
      await prisma.branchInventory.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.generalStock.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      await prisma.category.deleteMany({
        where: { id: { in: [ids.category, ids.hiddenCategory] } },
      });
      await prisma.unitMeasure.deleteMany({ where: { id: ids.unit } });
      await prisma.branch.deleteMany({
        where: { id: { in: [ids.branch, ids.otherBranch, ids.closedBranch] } },
      });
      await app.close();
    }
  }, 30000);

  it("lists only the available products without a token", async () => {
    const response = await get(`/products?search=${runId}&limit=48`);

    expect(response.status).toBe(200);
    const body = response.body as {
      data: CatalogItem[];
      meta: { total: number };
    };
    expect(body.data.map((item) => item.name)).toEqual([
      `${runId} Bodega`,
      `${runId} Sedes`,
    ]);
    expect(body.meta.total).toBe(2);
    expect(body.data[1]).toEqual({
      productId: products.Sedes,
      name: `${runId} Sedes`,
      referenceCode: `CAT-Sedes-${runId}`,
      category: { id: ids.category, name: `${runId} Proteína cat` },
      price: "200000.00",
      imageUrl: null,
      branchUnits: 10,
      availableInWarehouse: false,
      branches: [
        { branchId: ids.branch, name: `${runId} Centro catalogo`, quantity: 8 },
        {
          branchId: ids.otherBranch,
          name: `${runId} Norte catalogo`,
          quantity: 2,
        },
      ],
    });
    expect(body.data[0]).toMatchObject({
      branchUnits: 0,
      availableInWarehouse: true,
      branches: [],
    });
    expect(body.data[0]).not.toHaveProperty("warehouseQuantity");
  });

  it("sorts by price and filters by branch and category", async () => {
    const byPrice = await get(`/products?search=${runId}&sort=price_desc`);
    expect(
      (byPrice.body as { data: CatalogItem[] }).data.map((item) => item.price),
    ).toEqual(["200000.00", "90000.00"]);

    const inBranch = await get(
      `/products?search=${runId}&branchId=${ids.otherBranch}`,
    );
    expect(
      (inBranch.body as { data: CatalogItem[] }).data.map(
        (item) => item.productId,
      ),
    ).toEqual([products.Sedes]);

    const inCategory = await get(`/products?categoryId=${ids.category}`);
    expect((inCategory.body as { meta: { total: number } }).meta.total).toBe(2);
  });

  it("counts the available products of each active category", async () => {
    const response = await get("/categories");

    expect(response.status).toBe(200);
    const categories = (
      response.body as {
        data: { categoryId: string; name: string; productCount: number }[];
      }
    ).data;
    expect(categories).toContainEqual({
      categoryId: ids.category,
      name: `${runId} Proteína cat`,
      productCount: 2,
    });
    expect(categories.map((item) => item.categoryId)).not.toContain(
      ids.hiddenCategory,
    );
  });

  it("shows the detail of an available product", async () => {
    const response = await get(`/products/${products.Sedes}`);

    expect(response.status).toBe(200);
    expect((response.body as { data: unknown }).data).toMatchObject({
      productId: products.Sedes,
      description: "Descripción Sedes",
      images: [],
      branchUnits: 10,
    });
  });

  it.each(["Vencido", "Inactivo", "SedeCerrada", "CategoriaOculta"])(
    "hides the %s product",
    async (key) => {
      const response = await get(`/products/${products[key]}`);

      expect(response.status).toBe(404);
      expect((response.body as { error: { code: string } }).error.code).toBe(
        "PRODUCT_NOT_FOUND",
      );
    },
  );

  it("rejects short searches and invalid filters", async () => {
    expect((await get("/products?search=a")).status).toBe(400);
    expect((await get("/products?sort=cheap")).status).toBe(400);
    expect((await get("/products?limit=100")).status).toBe(400);
    expect((await get("/products/not-a-uuid")).status).toBe(400);
  });
});
