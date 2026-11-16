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

interface ApiError {
  error: { code: string; message: string };
}

interface StockRow {
  supplyId: string;
  supply: { name: string; unitOfMeasure: { id: string; abbreviation: string } };
  branchId: string;
  branchName: string;
  quantity: string;
  minimumQuantity: string;
  lowStock: boolean;
  updatedAt: string | null;
}

interface StockPage {
  data: StockRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const runId = Date.now().toString(36);
const tag = runId.slice(-6);
const DOCUMENT_CODE = "CC-SUPPLY-STOCK-E2E";

describe("Supply stock (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const personIds: string[] = [];
  const tokens = {} as Record<TestRole, string>;
  const branchIds: string[] = [];
  const supplyIds: string[] = [];
  let unitId: string;
  let branchA: string;
  let branchB: string;
  let supplyId: string;

  const api = () => request(app.getHttpServer());

  const listStock = (token: string, query: string) =>
    api()
      .get(`/api/v1/supply-stock?${query}`)
      .set("Authorization", `Bearer ${token}`);

  const move = (token: string, body: Record<string, unknown>) =>
    api()
      .post("/api/v1/supply-stock/movement")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const setMinimum = (token: string, body: Record<string, unknown>) =>
    api()
      .patch("/api/v1/supply-stock/minimum")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const rowOf = async (token: string, branchId: string) => {
    const response = await listStock(
      token,
      `branchId=${branchId}&search=${encodeURIComponent(runId)}`,
    );
    return (response.body as StockPage).data.find(
      (row) => row.supplyId === supplyId,
    );
  };

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
        create: { code: DOCUMENT_CODE, name: "Documento (e2e stock insumos)" },
      })
    ).id;

    for (const name of ["A", "B"]) {
      const branch = await prisma.branch.create({
        data: {
          name: `${runId} Sede ${name} insumos`,
          address: "Calle 1",
          phone: "3001111111",
        },
      });
      branchIds.push(branch.id);
    }
    [branchA, branchB] = branchIds;

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
          lastName: "Supply Stock E2E",
          email: `${roleName.toLowerCase()}.supply-stock.${runId}@e2e.test`,
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
          data: {
            userId: person.id,
            branchId: branchA,
            assignmentDate: new Date("2026-01-01T00:00:00.000Z"),
          },
        });
      }
    }

    unitId = (
      await prisma.unitMeasure.create({
        data: { name: `Gramo insumos ${runId}`, abreviation: `gi${tag}` },
      })
    ).id;
  });

  afterAll(async () => {
    if (prisma) {
      if (supplyIds.length > 0) {
        await prisma.supplyStockMovement.deleteMany({
          where: { supplyId: { in: supplyIds } },
        });
        await prisma.supplyStock.deleteMany({
          where: { supplyId: { in: supplyIds } },
        });
        await prisma.supply.deleteMany({ where: { id: { in: supplyIds } } });
      }
      if (unitId) {
        await prisma.unitMeasure.deleteMany({ where: { id: unitId } });
      }
      if (personIds.length > 0) {
        await prisma.userBranch.deleteMany({
          where: { userId: { in: personIds } },
        });
        await prisma.auditLog.deleteMany({
          where: { userId: { in: personIds } },
        });
        await prisma.userAccount.deleteMany({
          where: { personId: { in: personIds } },
        });
        await prisma.person.deleteMany({ where: { id: { in: personIds } } });
      }
      if (branchIds.length > 0) {
        await prisma.supplyStock.deleteMany({
          where: { branchId: { in: branchIds } },
        });
        await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
      }
      await prisma.documentType.deleteMany({
        where: { code: DOCUMENT_CODE },
      });
      await app.close();
    }
  });

  it("creates a supply with stock 0 in every active branch", async () => {
    const response = await api()
      .post("/api/v1/supplies")
      .set("Authorization", `Bearer ${tokens.SUPERADMIN}`)
      .send({ name: `E2E Leche ${runId}`, unitOfMeasureId: unitId });

    expect(response.status).toBe(201);
    const supply = (
      response.body as {
        data: { id: string; unitOfMeasure: { abbreviation: string } };
      }
    ).data;
    supplyId = supply.id;
    supplyIds.push(supplyId);
    expect(supply.unitOfMeasure.abbreviation).toBe(`gi${tag}`);

    const stocks = await prisma.supplyStock.findMany({
      where: { supplyId, branchId: { in: branchIds } },
    });
    expect(stocks).toHaveLength(2);
    expect(stocks.every((stock) => stock.quantity.toNumber() === 0)).toBe(true);
  });

  it("lists the stock of the branch with the contract shape and pagination", async () => {
    const response = await listStock(
      tokens.BRANCH_LEADER,
      `branchId=${branchA}&search=${encodeURIComponent(runId)}&limit=5`,
    );

    expect(response.status).toBe(200);
    const body = response.body as StockPage;
    expect(body.meta).toEqual({ page: 1, limit: 5, total: 1, totalPages: 1 });
    expect(body.data[0]).toEqual({
      supplyId,
      supply: {
        name: `E2E Leche ${runId}`,
        unitOfMeasure: { id: unitId, abbreviation: `gi${tag}` },
      },
      branchId: branchA,
      branchName: `${runId} Sede A insumos`,
      quantity: "0.000",
      minimumQuantity: "0.000",
      lowStock: false,
      updatedAt: expect.any(String),
      sourceProduct: null,
    });
  });

  it("keeps branch roles inside their branches", async () => {
    const otherBranch = await listStock(
      tokens.BRANCH_LEADER,
      `branchId=${branchB}`,
    );
    const withoutBranch = await listStock(tokens.BRANCH_ASSISTANT, "page=1");

    expect(otherBranch.status).toBe(403);
    expect(withoutBranch.status).toBe(403);
  });

  it("lets the superadmin see the supply in every active branch", async () => {
    const response = await listStock(
      tokens.SUPERADMIN,
      `search=${encodeURIComponent(runId)}&limit=100`,
    );

    expect(response.status).toBe(200);
    const branches = (response.body as StockPage).data
      .filter((row) => row.supplyId === supplyId)
      .map((row) => row.branchId);
    expect(branches).toEqual(expect.arrayContaining(branchIds));
    expect(await prisma.branch.count({ where: { active: true } })).toBe(
      branches.length,
    );
  });

  it("lets the leader set the minimum of the branch and flags the low stock", async () => {
    const response = await setMinimum(tokens.BRANCH_LEADER, {
      branchId: branchA,
      supplyId,
      minimumQuantity: 50,
    });

    expect(response.status).toBe(200);
    const row = (response.body as { data: StockRow }).data;
    expect(row.minimumQuantity).toBe("50.000");
    expect(row.lowStock).toBe(true);

    const lowStock = await listStock(
      tokens.BRANCH_LEADER,
      `branchId=${branchA}&lowStock=true&search=${encodeURIComponent(runId)}`,
    );
    expect(
      (lowStock.body as StockPage).data.map((item) => item.supplyId),
    ).toEqual([supplyId]);
    expect(
      await prisma.auditLog.count({
        where: { entity: "SUPPLY_STOCK", entityId: supplyId },
      }),
    ).toBe(1);
  });

  it("does not let the assistant change the minimum nor the leader touch another branch", async () => {
    const assistant = await setMinimum(tokens.BRANCH_ASSISTANT, {
      branchId: branchA,
      supplyId,
      minimumQuantity: 5,
    });
    const otherBranch = await setMinimum(tokens.BRANCH_LEADER, {
      branchId: branchB,
      supplyId,
      minimumQuantity: 5,
    });

    expect(assistant.status).toBe(403);
    expect(otherBranch.status).toBe(403);
    expect((otherBranch.body as ApiError).error.code).toBe(
      "BRANCH_SCOPE_VIOLATION",
    );
  });

  it("registers an entry and an exit and keeps the stock in sync", async () => {
    const entry = await move(tokens.BRANCH_ASSISTANT, {
      branchId: branchA,
      supplyId,
      movementType: "ENTRY",
      quantity: 80,
    });
    expect(entry.status).toBe(201);
    expect(entry.body).toEqual({
      data: {
        id: expect.any(String),
        movementType: "ENTRY",
        quantity: "80",
        supply: { id: supplyId, name: `E2E Leche ${runId}` },
        branch: { id: branchA, name: `${runId} Sede A insumos` },
        user: {
          id: personIds[2],
          fullName: "BRANCH_ASSISTANT Supply Stock E2E",
        },
        observation: null,
        resultingQuantity: "80",
        movementAt: expect.any(String),
      },
    });

    const exit = await move(tokens.BRANCH_ASSISTANT, {
      branchId: branchA,
      supplyId,
      movementType: "EXIT",
      quantity: 30,
      observation: "Preparación de batidos",
    });
    expect(exit.status).toBe(201);
    expect(
      (exit.body as { data: { resultingQuantity: string } }).data
        .resultingQuantity,
    ).toBe("50");

    const row = await rowOf(tokens.BRANCH_LEADER, branchA);
    expect(row?.quantity).toBe("50.000");
    expect(row?.lowStock).toBe(false);
  });

  it("rejects an exit above the stock and an exit without observation", async () => {
    const tooMuch = await move(tokens.BRANCH_LEADER, {
      branchId: branchA,
      supplyId,
      movementType: "EXIT",
      quantity: 51,
      observation: "Merma",
    });
    const noObservation = await move(tokens.BRANCH_LEADER, {
      branchId: branchA,
      supplyId,
      movementType: "EXIT",
      quantity: 1,
    });

    expect(tooMuch.status).toBe(422);
    expect((tooMuch.body as ApiError).error.code).toBe(
      "INSUFFICIENT_SUPPLY_STOCK",
    );
    expect(noObservation.status).toBe(400);
    expect((await rowOf(tokens.BRANCH_LEADER, branchA))?.quantity).toBe(
      "50.000",
    );
  });

  it("shows the supply in a branch created later and assigns it on the first entry", async () => {
    const branch = await prisma.branch.create({
      data: {
        name: `${runId} Sede C insumos`,
        address: "Calle 3",
        phone: "3003333333",
      },
    });
    branchIds.push(branch.id);
    await prisma.userBranch.create({
      data: {
        userId: personIds[1],
        branchId: branch.id,
        assignmentDate: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const leaderToken = await app
      .get(JwtService)
      .signAsync({ sub: personIds[1] });

    const before = await rowOf(leaderToken, branch.id);
    expect(before?.quantity).toBe("0");
    expect(before?.updatedAt).toBeNull();

    const entry = await move(leaderToken, {
      branchId: branch.id,
      supplyId,
      movementType: "ENTRY",
      quantity: 10,
    });
    expect(entry.status).toBe(201);
    expect((await rowOf(leaderToken, branch.id))?.quantity).toBe("10.000");
  });

  it("lets the superadmin register an entry in any branch", async () => {
    const response = await move(tokens.SUPERADMIN, {
      branchId: branchA,
      supplyId,
      movementType: "ENTRY",
      quantity: 1,
    });

    expect(response.status).toBe(201);
  });
});
