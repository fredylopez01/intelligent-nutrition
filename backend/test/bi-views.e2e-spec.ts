import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

interface SalesReportRow {
  day: string;
  branch: { id: string; name: string };
  salesCount: number;
  totalAmount: string;
}

interface BiSalesRow {
  day: string;
  branchId: string;
  salesCount: number;
  totalAmount: string;
}

interface RestockRow {
  productId: string;
  branchId: string;
}

const runId = randomUUID().replace(/-/g, "").slice(0, 16);
const SALE_PREFIX = `BI-${runId}-`;
const RANGE = { from: "2026-10-05", to: "2026-10-06", limit: "100" };

describe("BI views against HS-120 reports (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = "";
  let documentTypeId = "";
  let categoryId = "";
  let unitId = "";
  let branchAId = "";
  let branchBId = "";
  let personId = "";
  let promotionId = "";
  let productAId = "";
  let productBId = "";
  let productCId = "";
  let discountedSaleId = "";
  let promotedSaleId = "";
  let reversedSaleId = "";
  let completedSaleId = "";

  const branchIds = () => [branchAId, branchBId].filter(Boolean);

  const salesReport = (query: Record<string, string>) =>
    request(app.getHttpServer())
      .get("/api/v1/reports/sales")
      .set("Authorization", `Bearer ${token}`)
      .query(query);

  const restockReport = (branchId: string) =>
    request(app.getHttpServer())
      .get("/api/v1/reports/restock")
      .set("Authorization", `Bearer ${token}`)
      .query({ branchId });

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
        data: {
          code: `BI-${runId}`.slice(0, 20),
          name: "Document (e2e BI views)",
        },
      })
    ).id;

    const superadminRole = await prisma.role.upsert({
      where: { name: "SUPERADMIN" },
      update: { active: true },
      create: { name: "SUPERADMIN" },
    });
    const person = await prisma.person.create({
      data: {
        documentTypeId,
        documentNumber: `BI-${runId}`,
        firstName: "BI views",
        lastName: "E2E",
        email: `bi-views.${runId}@e2e.test`,
        phone: "3009998877",
        address: "Carrera 9 # 8-7",
        userAccount: {
          create: {
            roleId: superadminRole.id,
            active: true,
            mustChangePassword: false,
          },
        },
      },
    });
    personId = person.id;
    token = await jwtService.signAsync({ sub: personId });

    const branchA = await prisma.branch.create({
      data: {
        name: `BI ${runId} Sede A`,
        address: "Calle 1",
        phone: "3001111111",
      },
    });
    const branchB = await prisma.branch.create({
      data: {
        name: `BI ${runId} Sede B`,
        address: "Calle 2",
        phone: "3002222222",
      },
    });
    branchAId = branchA.id;
    branchBId = branchB.id;

    categoryId = (
      await prisma.category.create({
        data: { name: `BI ${runId} Categoria` },
      })
    ).id;
    unitId = (
      await prisma.unitMeasure.create({
        data: {
          name: `BI ${runId} Unidad`,
          abreviation: `BI${runId}`.slice(0, 10),
        },
      })
    ).id;

    const products = await Promise.all(
      ["A", "B", "C"].map((suffix) =>
        prisma.product.create({
          data: {
            name: `BI ${runId} Producto ${suffix}`,
            referenceCode: `BI-${runId}-${suffix}`,
            categoryId,
            unitOfMeasureId: unitId,
            price: "100.00",
            active: true,
          },
        }),
      ),
    );
    [productAId, productBId, productCId] = products.map(({ id }) => id);

    await prisma.branchInventory.createMany({
      data: [
        {
          branchId: branchAId,
          productId: productAId,
          quantity: 2,
          minimumStock: 10,
          expirationDate: new Date("2027-01-31T00:00:00.000Z"),
        },
        {
          branchId: branchAId,
          productId: productAId,
          quantity: 3,
          minimumStock: 10,
          expirationDate: new Date("2027-02-28T00:00:00.000Z"),
        },
        {
          branchId: branchAId,
          productId: productCId,
          quantity: 4,
          minimumStock: 4,
          expirationDate: new Date("2027-01-31T00:00:00.000Z"),
        },
        {
          branchId: branchBId,
          productId: productBId,
          quantity: 0,
          minimumStock: 5,
          expirationDate: new Date("2027-01-31T00:00:00.000Z"),
        },
      ],
    });

    const promotion = await prisma.promotion.create({
      data: {
        createdById: personId,
        name: `BI ${runId} Promocion`,
        discountPercentage: "10.00",
        active: false,
      },
    });
    promotionId = promotion.id;

    const createSale = (
      saleNumber: string,
      branchId: string,
      saleAt: string,
      values: {
        subtotal: string;
        discountAmount: string;
        promotionDiscount?: string;
        total: string;
        status?: "COMPLETED" | "REVERSED";
        promotionId?: string;
        details: Array<{
          productId: string;
          quantity: number;
          unitPrice: string;
          subtotal: string;
          discountAmount: string;
          total: string;
        }>;
      },
    ) =>
      prisma.sale.create({
        data: {
          saleNumber,
          branchId,
          userId: personId,
          saleAt: new Date(saleAt),
          subtotal: values.subtotal,
          discountAmount: values.discountAmount,
          promotionDiscount: values.promotionDiscount,
          promotionId: values.promotionId,
          taxAmount: "0.00",
          total: values.total,
          status: values.status ?? "COMPLETED",
          details: {
            create: values.details.map((detail) => ({
              ...detail,
              taxAmount: "0.00",
            })),
          },
        },
        select: { id: true },
      });

    const discounted = await createSale(
      `${SALE_PREFIX}discount`,
      branchAId,
      "2026-10-05T15:00:00.000Z",
      {
        subtotal: "300.00",
        discountAmount: "30.00",
        total: "270.00",
        details: [
          {
            productId: productAId,
            quantity: 1,
            unitPrice: "100.00",
            subtotal: "100.00",
            discountAmount: "10.00",
            total: "90.00",
          },
          {
            productId: productBId,
            quantity: 2,
            unitPrice: "100.00",
            subtotal: "200.00",
            discountAmount: "20.00",
            total: "180.00",
          },
        ],
      },
    );
    discountedSaleId = discounted.id;

    const promoted = await createSale(
      `${SALE_PREFIX}promotion`,
      branchBId,
      "2026-10-05T17:00:00.000Z",
      {
        subtotal: "200.00",
        discountAmount: "0.00",
        promotionDiscount: "20.00",
        promotionId,
        total: "180.00",
        details: [
          {
            productId: productAId,
            quantity: 1,
            unitPrice: "80.00",
            subtotal: "80.00",
            discountAmount: "8.00",
            total: "72.00",
          },
          {
            productId: productBId,
            quantity: 1,
            unitPrice: "120.00",
            subtotal: "120.00",
            discountAmount: "12.00",
            total: "108.00",
          },
        ],
      },
    );
    promotedSaleId = promoted.id;

    const completed = await createSale(
      `${SALE_PREFIX}next-day`,
      branchAId,
      "2026-10-06T15:00:00.000Z",
      {
        subtotal: "50.00",
        discountAmount: "0.00",
        total: "50.00",
        details: [
          {
            productId: productCId,
            quantity: 1,
            unitPrice: "50.00",
            subtotal: "50.00",
            discountAmount: "0.00",
            total: "50.00",
          },
        ],
      },
    );
    completedSaleId = completed.id;

    const reversed = await createSale(
      `${SALE_PREFIX}reversed`,
      branchBId,
      "2026-10-06T17:00:00.000Z",
      {
        subtotal: "99.00",
        discountAmount: "0.00",
        total: "99.00",
        status: "REVERSED",
        details: [
          {
            productId: productBId,
            quantity: 1,
            unitPrice: "99.00",
            subtotal: "99.00",
            discountAmount: "0.00",
            total: "99.00",
          },
        ],
      },
    );
    reversedSaleId = reversed.id;
  }, 30000);

  afterAll(async () => {
    try {
      await prisma?.saleDetail.deleteMany({
        where: { sale: { saleNumber: { startsWith: SALE_PREFIX } } },
      });
      await prisma?.sale.deleteMany({
        where: { saleNumber: { startsWith: SALE_PREFIX } },
      });
      await prisma?.promotion.deleteMany({
        where: { id: promotionId },
      });
      await prisma?.branchInventory.deleteMany({
        where: { branchId: { in: branchIds() } },
      });
      await prisma?.product.deleteMany({
        where: { referenceCode: { startsWith: `BI-${runId}-` } },
      });
      await prisma?.category.deleteMany({ where: { id: categoryId } });
      await prisma?.unitMeasure.deleteMany({ where: { id: unitId } });
      await prisma?.userAccount.deleteMany({ where: { personId } });
      await prisma?.person.deleteMany({ where: { id: personId } });
      await prisma?.branch.deleteMany({
        where: { id: { in: branchIds() } },
      });
      await prisma?.documentType.deleteMany({
        where: { id: documentTypeId },
      });
    } finally {
      await app?.close();
    }
  }, 30000);

  it("matches BI sales totals by business day and branch with HS-120", async () => {
    for (const branchId of branchIds()) {
      const reportResponse = await salesReport({
        ...RANGE,
        branchId,
      }).expect(200);
      const reportRows = (
        reportResponse.body as { data: SalesReportRow[] }
      ).data.map((row) => ({
        day: row.day,
        branchId: row.branch.id,
        salesCount: row.salesCount,
        totalAmount: row.totalAmount,
      }));

      const viewRows = await prisma.$queryRaw<BiSalesRow[]>`
        SELECT sale_date::text AS day,
               branch_id AS "branchId",
               COUNT(*)::int AS "salesCount",
               SUM(total)::text AS "totalAmount"
        FROM public.bi_sales
        WHERE branch_id = ${branchId}
          AND sale_date BETWEEN ${RANGE.from}::date AND ${RANGE.to}::date
        GROUP BY sale_date, branch_id
        ORDER BY sale_date DESC
      `;

      expect(reportRows).toEqual(viewRows);
    }
  });

  it("allocates each completed sale total across lines with global and promotion discounts", async () => {
    for (const saleId of [discountedSaleId, promotedSaleId, completedSaleId]) {
      const [row] = await prisma.$queryRaw<Array<{ totalsMatch: boolean }>>`
        SELECT sales.total = SUM(lines.net_amount) AS "totalsMatch"
        FROM public.bi_sales sales
        INNER JOIN public.bi_sale_lines lines ON lines.sale_id = sales.sale_id
        WHERE sales.sale_id = ${saleId}
        GROUP BY sales.total
      `;

      expect(row).toBeDefined();
      expect(row.totalsMatch).toBe(true);
    }

    const [discounts] = await prisma.$queryRaw<
      Array<{
        hasGlobalDiscount: boolean;
        hasNoPromotionDiscount: boolean;
        promotionName: string | null;
      }>
    >`
      SELECT discount_amount = 30 AS "hasGlobalDiscount",
             promotion_discount = 0 AS "hasNoPromotionDiscount",
             promotion_name AS "promotionName"
      FROM public.bi_sales
      WHERE sale_id = ${discountedSaleId}
    `;
    expect(discounts).toMatchObject({
      hasGlobalDiscount: true,
      hasNoPromotionDiscount: true,
      promotionName: null,
    });

    const [promotion] = await prisma.$queryRaw<
      Array<{
        hasNoGlobalDiscount: boolean;
        hasPromotionDiscount: boolean;
        promotionName: string;
      }>
    >`
      SELECT discount_amount = 0 AS "hasNoGlobalDiscount",
             promotion_discount = 20 AS "hasPromotionDiscount",
             promotion_name AS "promotionName"
      FROM public.bi_sales
      WHERE sale_id = ${promotedSaleId}
    `;
    expect(promotion).toMatchObject({
      hasNoGlobalDiscount: true,
      hasPromotionDiscount: true,
      promotionName: `BI ${runId} Promocion`,
    });
  });

  it("matches below-minimum stock products with the HS-120 restock report", async () => {
    for (const branchId of branchIds()) {
      const reportResponse = await restockReport(branchId).expect(200);
      const reportProducts = (
        reportResponse.body as { data: RestockRow[] }
      ).data.map(({ productId, branchId: rowBranchId }) => ({
        productId,
        branchId: rowBranchId,
      }));

      const viewProducts = await prisma.$queryRaw<RestockRow[]>`
        SELECT product_id AS "productId",
               branch_id AS "branchId"
        FROM public.bi_stock_status
        WHERE branch_id = ${branchId}
          AND below_minimum = true
        ORDER BY product_id
      `;

      expect(reportProducts).toHaveLength(1);
      expect(reportProducts[0].productId).toBe(
        branchId === branchAId ? productAId : productBId,
      );
      expect(
        reportProducts.sort((a, b) => a.productId.localeCompare(b.productId)),
      ).toEqual(
        viewProducts.sort((a, b) => a.productId.localeCompare(b.productId)),
      );
    }
  });

  it("excludes reversed sales from bi_sales and bi_sale_lines", async () => {
    const salesRows = await prisma.$queryRaw<Array<{ saleId: string }>>`
      SELECT sale_id AS "saleId"
      FROM public.bi_sales
      WHERE sale_id = ${reversedSaleId}
    `;
    const lineRows = await prisma.$queryRaw<Array<{ saleId: string }>>`
      SELECT sale_id AS "saleId"
      FROM public.bi_sale_lines
      WHERE sale_id = ${reversedSaleId}
    `;

    expect(salesRows).toEqual([]);
    expect(lineRows).toEqual([]);
  });
});
