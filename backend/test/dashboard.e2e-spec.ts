import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

const ROLES = ["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const;

type TestRole = (typeof ROLES)[number];

interface Alert {
  type: string;
  productId: string;
  quantity: number;
  branches: { id: string; name: string }[];
  expirationDate: string | null;
}

interface Dashboard {
  date: string;
  branch: { id: string; name: string } | null;
  salesToday: { count: number; totalAmount: number };
  salesYesterdayUntilNow: number;
  salesLast7Days: { date: string; totalAmount: number }[];
  stock: {
    totalUnits: number;
    byCategory: { categoryId: string; name: string; units: number }[];
  };
  branches: {
    active: number;
    open: number;
    items: {
      branchId: string;
      name: string;
      open: boolean;
      salesToday: number;
    }[];
  };
  alerts: { total: number; lowStockProducts: number; items: Alert[] };
  topProducts: unknown[];
  branchesActive?: number;
}

const runId = Date.now().toString(36);
const DOCUMENT_CODE = "CC-DASHBOARD-E2E";
const DAY_MS = 24 * 60 * 60 * 1000;

describe("Dashboard (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const personIds: string[] = [];
  const tokens = {} as Record<TestRole, string>;
  let branchId = "";
  let otherBranchId = "";
  let categoryId = "";
  let unitId = "";
  const productIds: string[] = [];

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/dashboard${path}`)
      .set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const documentTypeId = (
      await prisma.documentType.upsert({
        where: { code: DOCUMENT_CODE },
        update: { active: true },
        create: { code: DOCUMENT_CODE, name: "Documento (e2e dashboard)" },
      })
    ).id;
    branchId = (
      await prisma.branch.create({
        data: {
          name: `${runId} Sede dashboard`,
          address: "Calle 1",
          phone: "3001",
        },
      })
    ).id;
    otherBranchId = (
      await prisma.branch.create({
        data: {
          name: `${runId} Otra sede dashboard`,
          address: "Calle 2",
          phone: "3002",
        },
      })
    ).id;

    const jwtService = app.get(JwtService);
    for (const [index, roleName] of ROLES.entries()) {
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
          lastName: "Dashboard E2E",
          email: `${roleName.toLowerCase()}.dashboard.${runId}@e2e.test`,
          phone: "3000000000",
          address: "Calle 1 # 2-3",
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
      await prisma.category.create({
        data: { name: `${runId} Proteína dashboard` },
      })
    ).id;
    unitId = (
      await prisma.unitMeasure.create({
        data: {
          name: `${runId} Und dashboard`,
          abreviation: `D${runId.slice(-8)}`,
        },
      })
    ).id;
    for (const name of ["Agotado", "Ultima", "Vence"]) {
      productIds.push(
        (
          await prisma.product.create({
            data: {
              name: `${runId} ${name}`,
              referenceCode: `DSH-${name}-${runId}`,
              categoryId,
              unitOfMeasureId: unitId,
              price: "100000.00",
            },
          })
        ).id,
      );
    }
    const soon = new Date(Date.now() + 20 * DAY_MS);
    soon.setUTCHours(0, 0, 0, 0);
    await prisma.branchInventory.createMany({
      data: [
        {
          branchId,
          productId: productIds[0],
          quantity: 0,
          minimumStock: 2,
          expirationDate: new Date("2028-01-01T00:00:00Z"),
        },
        {
          branchId,
          productId: productIds[1],
          quantity: 1,
          minimumStock: 0,
          expirationDate: new Date("2028-01-01T00:00:00Z"),
        },
        {
          branchId,
          productId: productIds[2],
          quantity: 9,
          minimumStock: 0,
          expirationDate: soon,
        },
      ],
    });
    await prisma.cashShift.create({
      data: { branchId, userId: personIds[1], openingAmount: "0.00" },
    });
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      await prisma.cashShift.deleteMany({
        where: { branchId: { in: [branchId, otherBranchId] } },
      });
      await prisma.branchInventory.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      await prisma.category.deleteMany({ where: { id: categoryId } });
      await prisma.unitMeasure.deleteMany({ where: { id: unitId } });
      await prisma.userBranch.deleteMany({
        where: { userId: { in: personIds } },
      });
      await prisma.userAccount.deleteMany({
        where: { personId: { in: personIds } },
      });
      await prisma.person.deleteMany({ where: { id: { in: personIds } } });
      await prisma.branch.deleteMany({
        where: { id: { in: [branchId, otherBranchId] } },
      });
      await prisma.documentType.deleteMany({ where: { code: DOCUMENT_CODE } });
      await app.close();
    }
  }, 30000);

  it("shows the branch indicators with its alerts, stock and open cash shift", async () => {
    const response = await get(`/branch/${branchId}`, tokens.BRANCH_ASSISTANT);

    expect(response.status).toBe(200);
    const body = (response.body as { data: Dashboard }).data;
    expect(body.branch).toEqual({
      id: branchId,
      name: `${runId} Sede dashboard`,
    });
    expect(body.salesToday).toEqual({ count: 0, totalAmount: 0 });
    expect(body.salesLast7Days).toHaveLength(7);
    expect(body.salesLast7Days[6].date).toBe(body.date);
    expect(body.stock).toEqual({
      totalUnits: 10,
      byCategory: [
        { categoryId, name: `${runId} Proteína dashboard`, units: 10 },
      ],
    });
    expect(body.branches).toEqual({
      active: 1,
      open: 1,
      items: [
        {
          branchId,
          name: `${runId} Sede dashboard`,
          open: true,
          salesToday: 0,
        },
      ],
    });
    expect(
      body.alerts.items.map((alert) => [alert.type, alert.productId]),
    ).toEqual([
      ["OUT_OF_STOCK", productIds[0]],
      ["LAST_UNIT", productIds[1]],
      ["EXPIRING", productIds[2]],
    ]);
    expect(body.alerts.lowStockProducts).toBe(1);
    expect(body.topProducts).toEqual([]);
  });

  it("keeps branch roles inside their branches", async () => {
    const response = await get(
      `/branch/${otherBranchId}`,
      tokens.BRANCH_LEADER,
    );

    expect(response.status).toBe(403);
  });

  it("gives the superadmin the global dashboard of every active branch", async () => {
    const response = await get("/global", tokens.SUPERADMIN);

    expect(response.status).toBe(200);
    const body = (response.body as { data: Dashboard }).data;
    expect(body.branch).toBeNull();
    expect(body.branches.items.map((item) => item.branchId)).toEqual(
      expect.arrayContaining([branchId, otherBranchId]),
    );
    expect(body.branchesActive).toBe(body.branches.active);
    expect(body).toHaveProperty("totalSalesToday");
    expect(body).toHaveProperty("topBranch");
  });

  it.each(["BRANCH_LEADER", "BRANCH_ASSISTANT"] as const)(
    "does not give the global dashboard to %s",
    async (role) => {
      const response = await get("/global", tokens[role]);

      expect(response.status).toBe(403);
    },
  );
});
