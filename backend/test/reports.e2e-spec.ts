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

interface SalesReportRow {
  day: string;
  branch: { id: string; name: string };
  salesCount: number;
  totalAmount: string;
}

interface SalesReportBody {
  data: SalesReportRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface RestockRow {
  productId: string;
  name: string;
  referenceCode: string;
  branchId: string;
  branchName: string;
  currentQuantity: number;
  minimumStock: number;
  deficit: number;
}

interface ApiError {
  error: { code: string; message: string };
}

const runId = Date.now().toString(36);
const SALE_PREFIX = `RPT-${runId}-`;
const PRODUCT_PREFIX = `RPT-${runId}-`;
const RANGE = { from: "2026-10-01", to: "2026-10-31" };

describe("GET /api/v1/reports (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let documentTypeId = "";
  let categoryId = "";
  let unitId = "";
  let branchAId = "";
  let branchBId = "";
  let lowProductId = "";
  const branchIds = () => [branchAId, branchBId];
  const personIds: string[] = [];
  const tokens = {} as Record<RoleName, string>;

  const get = (
    path: string,
    token?: string,
    query: Record<string, string> = {},
  ) => {
    const pending = request(app.getHttpServer()).get(path).query(query);
    if (token) pending.set("Authorization", `Bearer ${token}`);
    return pending;
  };

  const sales = (token: string, query: Record<string, string> = {}) =>
    get("/api/v1/reports/sales", token, query);

  const restock = (token: string, query: Record<string, string> = {}) =>
    get("/api/v1/reports/restock", token, query);

  const rowsOf = (body: unknown) => (body as SalesReportBody).data;

  // The service already returns { data: rows }, so the global interceptor wraps it
  // again: the endpoint responds { data: { data: rows } } instead of the contract shape.
  const restockRowsOf = (body: unknown): RestockRow[] =>
    (body as { data: { data: RestockRow[] } }).data.data;

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
        data: { code: `CC-RPT-${runId}`, name: "Document (e2e reports)" },
      })
    ).id;

    for (const [index, roleName] of (
      ["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const
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
          email: `${roleName.toLowerCase()}.reports.${runId}@e2e.test`,
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

    branchAId = (
      await prisma.branch.create({
        data: {
          name: `${runId} Sede A reports`,
          address: "Calle 1",
          phone: "3001111111",
        },
      })
    ).id;
    branchBId = (
      await prisma.branch.create({
        data: {
          name: `${runId} Sede B reports`,
          address: "Calle 2",
          phone: "3002222222",
        },
      })
    ).id;

    await prisma.userBranch.create({
      data: {
        userId: personIds[1],
        branchId: branchAId,
        assignmentDate: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    categoryId = (
      await prisma.category.create({ data: { name: `${runId} Categoria RPT` } })
    ).id;
    unitId = (
      await prisma.unitMeasure.create({
        data: {
          name: `${runId} Unidad RPT`,
          abreviation: `R${runId.slice(-8)}`,
        },
      })
    ).id;

    const products = await Promise.all(
      [
        { key: "bajo", active: true },
        { key: "critico", active: true },
        { key: "en-limite", active: true },
        { key: "inactivo", active: false },
        { key: "sede-b", active: true },
      ].map((product) =>
        prisma.product.create({
          data: {
            name: `${PRODUCT_PREFIX}${product.key}`,
            referenceCode: `${PRODUCT_PREFIX}${product.key}`,
            categoryId,
            unitOfMeasureId: unitId,
            price: "10000.00",
            active: product.active,
          },
        }),
      ),
    );

    const productByKey = Object.fromEntries(
      ["bajo", "critico", "en-limite", "inactivo", "sede-b"].map(
        (key, index) => [key, products[index].id],
      ),
    );
    lowProductId = productByKey.bajo;

    await prisma.branchInventory.createMany({
      data: [
        {
          branchId: branchAId,
          productId: productByKey.bajo,
          quantity: 2,
          minimumStock: 10,
          expirationDate: new Date("2027-01-31T00:00:00.000Z"),
        },
        {
          branchId: branchAId,
          productId: productByKey.bajo,
          quantity: 3,
          minimumStock: 10,
          expirationDate: new Date("2027-02-28T00:00:00.000Z"),
        },
        {
          branchId: branchAId,
          productId: productByKey.critico,
          quantity: 0,
          minimumStock: 20,
          expirationDate: new Date("2027-01-31T00:00:00.000Z"),
        },
        {
          branchId: branchAId,
          productId: productByKey["en-limite"],
          quantity: 10,
          minimumStock: 10,
          expirationDate: new Date("2027-01-31T00:00:00.000Z"),
        },
        {
          branchId: branchAId,
          productId: productByKey.inactivo,
          quantity: 0,
          minimumStock: 10,
          expirationDate: new Date("2027-01-31T00:00:00.000Z"),
        },
        {
          branchId: branchBId,
          productId: productByKey["sede-b"],
          quantity: 0,
          minimumStock: 5,
          expirationDate: new Date("2027-01-31T00:00:00.000Z"),
        },
      ],
    });

    const saleOf = (
      index: number,
      branchId: string,
      saleAt: string,
      total: string,
      status: "COMPLETED" | "REVERSED" = "COMPLETED",
    ) => ({
      saleNumber: `${SALE_PREFIX}${index}`,
      branchId,
      userId: personIds[0],
      saleAt: new Date(saleAt),
      subtotal: total,
      discountAmount: "0.00",
      taxAmount: "0.00",
      total,
      status,
    });

    await prisma.sale.createMany({
      data: [
        saleOf(1, branchAId, "2026-10-05T15:00:00.000Z", "1000.00"),
        saleOf(2, branchAId, "2026-10-05T18:00:00.000Z", "500.00"),
        saleOf(3, branchAId, "2026-10-06T15:00:00.000Z", "200.00"),
        saleOf(4, branchAId, "2026-10-05T16:00:00.000Z", "9999.00", "REVERSED"),
        saleOf(5, branchBId, "2026-10-05T17:00:00.000Z", "700.00"),
        saleOf(6, branchBId, "2026-10-05T04:59:00.000Z", "1234.00"),
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma?.sale.deleteMany({
        where: { saleNumber: { startsWith: SALE_PREFIX } },
      });
      await prisma?.branchInventory.deleteMany({
        where: { branchId: { in: branchIds() } },
      });
      await prisma?.product.deleteMany({
        where: { referenceCode: { startsWith: PRODUCT_PREFIX } },
      });
      await prisma?.category.deleteMany({ where: { id: categoryId } });
      await prisma?.unitMeasure.deleteMany({ where: { id: unitId } });
      await prisma?.userBranch.deleteMany({
        where: { userId: { in: personIds } },
      });
      await prisma?.userAccount.deleteMany({
        where: { personId: { in: personIds } },
      });
      await prisma?.person.deleteMany({ where: { id: { in: personIds } } });
      await prisma?.branch.deleteMany({
        where: { id: { in: branchIds() } },
      });
      await prisma?.documentType.deleteMany({ where: { id: documentTypeId } });
    } finally {
      await app?.close();
    }
  }, 30000);

  describe("access control", () => {
    it("requires authentication on both reports", async () => {
      await sales("").expect(401);
      await restock("").expect(401);
    });

    it.each([
      ["sales", "/api/v1/reports/sales"],
      ["restock", "/api/v1/reports/restock"],
    ])("denies the BRANCH_ASSISTANT role on %s", async (_name, path) => {
      const response = await get(
        path,
        tokens.BRANCH_ASSISTANT,
        RANGE,
      ).expect(403);

      expect((response.body as ApiError).error.code).toBe(
        "INSUFFICIENT_PERMISSIONS",
      );
    });

    it("rejects a branch leader without a branch filter", async () => {
      const salesResponse = await sales(tokens.BRANCH_LEADER).expect(403);
      const restockResponse = await restock(tokens.BRANCH_LEADER).expect(403);

      expect((salesResponse.body as ApiError).error.code).toBe(
        "BRANCH_SCOPE_VIOLATION",
      );
      expect((restockResponse.body as ApiError).error.code).toBe(
        "BRANCH_SCOPE_VIOLATION",
      );
    });

    it("rejects a branch leader asking for another branch", async () => {
      const salesResponse = await sales(tokens.BRANCH_LEADER, {
        ...RANGE,
        branchId: branchBId,
      }).expect(403);
      const restockResponse = await restock(tokens.BRANCH_LEADER, {
        branchId: branchBId,
      }).expect(403);

      expect((salesResponse.body as ApiError).error.code).toBe(
        "BRANCH_SCOPE_VIOLATION",
      );
      expect((restockResponse.body as ApiError).error.code).toBe(
        "BRANCH_SCOPE_VIOLATION",
      );
    });

    it("allows a branch leader on the branch assigned to them", async () => {
      await sales(tokens.BRANCH_LEADER, {
        ...RANGE,
        branchId: branchAId,
      }).expect(200);
      await restock(tokens.BRANCH_LEADER, { branchId: branchAId }).expect(200);
    });
  });

  describe("sales report", () => {
    it("groups completed sales by day and branch and skips the reversed ones", async () => {
      const response = await sales(tokens.SUPERADMIN, {
        ...RANGE,
        branchId: branchAId,
      }).expect(200);
      const body = response.body as SalesReportBody;

      expect(body.data).toEqual([
        {
          day: "2026-10-06",
          branch: { id: branchAId, name: `${runId} Sede A reports` },
          salesCount: 1,
          totalAmount: "200.00",
        },
        {
          day: "2026-10-05",
          branch: { id: branchAId, name: `${runId} Sede A reports` },
          salesCount: 2,
          totalAmount: "1500.00",
        },
      ]);
      expect(body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it("filters a single day when from and to match", async () => {
      const response = await sales(tokens.SUPERADMIN, {
        branchId: branchAId,
        from: "2026-10-06",
        to: "2026-10-06",
      }).expect(200);
      const body = response.body as SalesReportBody;

      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        day: "2026-10-06",
        totalAmount: "200.00",
      });
      expect(body.meta.total).toBe(1);
    });

    it("rejects an inverted date range", async () => {
      const response = await sales(tokens.SUPERADMIN, {
        branchId: branchAId,
        from: "2026-10-31",
        to: "2026-10-01",
      }).expect(400);

      expect((response.body as ApiError).error.code).toBe(
        "INVALID_DATE_RANGE",
      );
    });

    it("paginates the grouped rows", async () => {
      const firstPage = await sales(tokens.SUPERADMIN, {
        ...RANGE,
        branchId: branchAId,
        limit: "1",
        page: "1",
      }).expect(200);
      const secondPage = await sales(tokens.SUPERADMIN, {
        ...RANGE,
        branchId: branchAId,
        limit: "1",
        page: "2",
      }).expect(200);

      expect(rowsOf(firstPage.body).map((row) => row.day)).toEqual([
        "2026-10-06",
      ]);
      expect((firstPage.body as SalesReportBody).meta).toMatchObject({
        total: 2,
        totalPages: 2,
      });
      expect(rowsOf(secondPage.body).map((row) => row.day)).toEqual([
        "2026-10-05",
      ]);
    });

    it("returns every branch for a superadmin without a branch filter", async () => {
      const response = await sales(tokens.SUPERADMIN, RANGE).expect(200);
      const branchIdsInBody = new Set(
        rowsOf(response.body).map((row) => row.branch.id),
      );

      expect(branchIdsInBody.has(branchAId)).toBe(true);
      expect(branchIdsInBody.has(branchBId)).toBe(true);
    });

    it("counts a sale made before 05:00 UTC in the previous business day", async () => {
      const previousDay = await sales(tokens.SUPERADMIN, {
        branchId: branchBId,
        from: "2026-10-04",
        to: "2026-10-04",
      }).expect(200);
      const sameDay = await sales(tokens.SUPERADMIN, {
        branchId: branchBId,
        from: "2026-10-05",
        to: "2026-10-05",
      }).expect(200);

      expect(rowsOf(previousDay.body)).toEqual([
        {
          day: "2026-10-04",
          branch: { id: branchBId, name: `${runId} Sede B reports` },
          salesCount: 1,
          totalAmount: "1234.00",
        },
      ]);
      expect(rowsOf(sameDay.body)).toEqual([
        {
          day: "2026-10-05",
          branch: { id: branchBId, name: `${runId} Sede B reports` },
          salesCount: 1,
          totalAmount: "700.00",
        },
      ]);
    });
  });

  describe("restock report", () => {
    it("reports the deficit of a product below its minimum, summing its lots", async () => {
      const response = await restock(tokens.SUPERADMIN, {
        branchId: branchAId,
      }).expect(200);
      const row = restockRowsOf(response.body).find(
        (item) => item.productId === lowProductId,
      );

      expect(row).toMatchObject({
        name: `${PRODUCT_PREFIX}bajo`,
        referenceCode: `${PRODUCT_PREFIX}bajo`,
        branchId: branchAId,
        currentQuantity: 5,
        minimumStock: 10,
        deficit: 5,
      });
    });

    it("skips products that are exactly at their minimum", async () => {
      const response = await restock(tokens.SUPERADMIN, {
        branchId: branchAId,
      }).expect(200);

      expect(
        restockRowsOf(response.body).map((item) => item.name),
      ).not.toContain(`${PRODUCT_PREFIX}en-limite`);
    });

    it("skips inactive products", async () => {
      const response = await restock(tokens.SUPERADMIN, {
        branchId: branchAId,
      }).expect(200);

      expect(
        restockRowsOf(response.body).map((item) => item.name),
      ).not.toContain(`${PRODUCT_PREFIX}inactivo`);
    });

    it("filters the suggestions by branch", async () => {
      const branchB = await restock(tokens.SUPERADMIN, {
        branchId: branchBId,
      }).expect(200);
      const rows = restockRowsOf(branchB.body);

      expect(rows.map((item) => item.name)).toEqual([
        `${PRODUCT_PREFIX}sede-b`,
      ]);
      expect(rows[0]).toMatchObject({ branchId: branchBId, deficit: 5 });
    });

    it("orders the suggestions by ascending deficit", async () => {
      const response = await restock(tokens.SUPERADMIN, {
        branchId: branchAId,
      }).expect(200);
      const deficits = restockRowsOf(response.body).map(
        (item) => item.deficit,
      );

      expect(deficits).toEqual([5, 20]);
    });
  });
});
