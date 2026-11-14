import { beforeEach, describe, expect, it, jest } from "@jest/globals";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const prismaMock = {
  product: {
    count: jest.fn<AsyncMock>(),
    findMany: jest.fn<AsyncMock>(),
    findFirst: jest.fn<AsyncMock>(),
  },
  category: { findMany: jest.fn<AsyncMock>() },
  onlineOrderItem: { findMany: jest.fn<AsyncMock>() },
  $transaction: jest.fn<(operations: Promise<unknown>[]) => Promise<unknown>>(),
};

jest.unstable_mockModule("../../database/prisma/prisma.service.js", () => ({
  PrismaService: jest.fn().mockImplementation(() => prismaMock),
}));

const { Test } = await import("@nestjs/testing");
const { BadRequestException, NotFoundException } =
  await import("@nestjs/common");
const { CatalogService } = await import("./catalog.service.js");
const { CatalogSort } =
  await import("./dto/list-catalog-products-query.dto.js");
const { PrismaService } =
  await import("../../database/prisma/prisma.service.js");

const row = {
  id: "product-1",
  name: "Whey 5 lb",
  referenceCode: "WHEY",
  description: "Proteína",
  price: { toFixed: () => "339900.00" },
  category: { id: "category-1", name: "Proteína" },
  images: [
    { url: "https://cdn.test/primary.webp" },
    { url: "https://cdn.test/2.webp" },
  ],
  inventories: [
    { quantity: 5, branch: { id: "viva", name: "Sede Viva" } },
    { quantity: 3, branch: { id: "makro", name: "Sede Makro" } },
    { quantity: 4, branch: { id: "viva", name: "Sede Viva" } },
  ],
  generalStock: [{ quantity: 12 }],
};

describe("CatalogService", () => {
  let service: InstanceType<typeof CatalogService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation((operations) =>
      Promise.all(operations),
    );
    prismaMock.product.count.mockResolvedValue(1);
    prismaMock.product.findMany.mockResolvedValue([row]);
    prismaMock.onlineOrderItem.findMany.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(CatalogService);
  });

  it("adds the lots per branch and hides the warehouse quantity", async () => {
    const result = await service.listProducts({
      page: 1,
      limit: 12,
      sort: CatalogSort.NAME,
    });

    expect(result.data).toEqual([
      {
        productId: "product-1",
        name: "Whey 5 lb",
        referenceCode: "WHEY",
        category: { id: "category-1", name: "Proteína" },
        price: "339900.00",
        imageUrl: "https://cdn.test/primary.webp",
        branchUnits: 12,
        availableInWarehouse: true,
        branches: [
          { branchId: "makro", name: "Sede Makro", quantity: 3 },
          { branchId: "viva", name: "Sede Viva", quantity: 9 },
        ],
      },
    ]);
    expect(result.meta).toEqual({
      page: 1,
      limit: 12,
      total: 1,
      totalPages: 1,
    });
  });

  it("hides the units held by web orders", async () => {
    prismaMock.onlineOrderItem.findMany.mockResolvedValue([
      { productId: "product-1", quantity: 3, order: { branchId: "makro" } },
      { productId: "product-1", quantity: 2, order: { branchId: "viva" } },
    ]);

    const result = await service.listProducts({
      page: 1,
      limit: 12,
      sort: CatalogSort.NAME,
    });

    expect(result.data[0].branches).toEqual([
      { branchId: "viva", name: "Sede Viva", quantity: 7 },
    ]);
    expect(result.data[0].branchUnits).toBe(7);
  });

  it("orders by price when asked", async () => {
    await service.listProducts({
      page: 2,
      limit: 12,
      sort: CatalogSort.PRICE_ASC,
    });

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ price: "asc" }, { name: "asc" }],
        skip: 12,
        take: 12,
      }),
    );
  });

  it("rejects a search shorter than 2 characters", async () => {
    await expect(
      service.listProducts({
        page: 1,
        limit: 12,
        sort: CatalogSort.NAME,
        search: " a ",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("returns the detail with every image", async () => {
    prismaMock.product.findFirst.mockResolvedValue(row);

    const result = await service.getProduct("product-1");

    expect(result.description).toBe("Proteína");
    expect(result.images).toEqual([
      "https://cdn.test/primary.webp",
      "https://cdn.test/2.webp",
    ]);
  });

  it("throws PRODUCT_NOT_FOUND when the product is not available", async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);

    await expect(service.getProduct("missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("maps the categories with their product count", async () => {
    prismaMock.category.findMany.mockResolvedValue([
      { id: "category-1", name: "Proteína", _count: { products: 4 } },
    ]);

    await expect(service.listCategories()).resolves.toEqual([
      { categoryId: "category-1", name: "Proteína", productCount: 4 },
    ]);
  });
});
