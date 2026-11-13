import { randomUUID } from "node:crypto";
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

interface SupplyStockItem {
  supplyId: string;
  branchId: string;
  quantity: string;
  minimumQuantity: string;
}

interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

const runId = randomUUID().replace(/-/g, "").slice(0, 10);
const DOCUMENT_CODE = `SUP-E2E-${runId}`;
const errorOf = (body: unknown) => (body as ApiError).error;

describe("Supplies and supply stock endpoints (e2e)", () => {
  let app: INestApplication<App> | undefined;
  let prisma: PrismaService;
  let documentTypeId = "";
  let unitOfMeasureId = "";
  let seedSupplyId = "";
  let branchAId = "";
  let branchBId = "";
  let sequence = 0;
  const personIds: string[] = [];
  const tokens = {} as Record<RoleName, string>;
  const actorIds = {} as Record<RoleName, string>;
  let createdSupplyId = "";

  const nextDocumentNumber = () => `${runId}-${(sequence += 1)}`;

  const postSupply = (body: object, token?: string) => {
    const pending = request(app!.getHttpServer()).post("/api/v1/supplies");
    if (token) pending.set("Authorization", `Bearer ${token}`);
    return pending.send(body);
  };

  const getSupplyStock = (branchId: string, token?: string) => {
    const pending = request(app!.getHttpServer())
      .get("/api/v1/supply-stock")
      .query({ branchId });
    if (token) pending.set("Authorization", `Bearer ${token}`);
    return pending;
  };

  const postMovement = (body: object, token?: string) => {
    const pending = request(app!.getHttpServer()).post(
      "/api/v1/supply-stock/movement",
    );
    if (token) pending.set("Authorization", `Bearer ${token}`);
    return pending.send(body);
  };

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
          code: DOCUMENT_CODE,
          name: "Documento (e2e insumos)",
        },
      })
    ).id;

    for (const roleName of [
      "SUPERADMIN",
      "BRANCH_LEADER",
      "BRANCH_ASSISTANT",
    ] as const) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: { active: true },
        create: { name: roleName },
      });
      const person = await prisma.person.create({
        data: {
          documentTypeId,
          documentNumber: nextDocumentNumber(),
          firstName: roleName,
          lastName: "E2E",
          email: `${roleName.toLowerCase()}.supplies.${runId}@e2e.test`,
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
      actorIds[roleName] = person.id;
      tokens[roleName] = await jwtService.signAsync({ sub: person.id });
    }

    const createBranch = (label: string) =>
      prisma.branch.create({
        data: {
          name: `E2E Insumos ${label} ${runId}`,
          address: "Calle 1 # 2-3",
          phone: "3001112233",
        },
      });
    branchAId = (await createBranch("A")).id;
    branchBId = (await createBranch("B")).id;

    const assignmentDate = new Date();
    assignmentDate.setUTCHours(0, 0, 0, 0);
    await prisma.userBranch.create({
      data: {
        userId: actorIds.BRANCH_LEADER,
        branchId: branchAId,
        assignmentDate,
        active: true,
      },
    });

    const unit = await prisma.unitMeasure.create({
      data: {
        name: `Unidad e2e ${runId}`,
        abreviation: `U${runId.slice(0, 8)}`,
      },
    });
    unitOfMeasureId = unit.id;

    const seedSupply = await prisma.supply.create({
      data: {
        name: `Insumo stock e2e ${runId}`,
        unitOfMeasureId,
      },
    });
    seedSupplyId = seedSupply.id;

    await prisma.supplyStock.createMany({
      data: [
        {
          branchId: branchAId,
          supplyId: seedSupplyId,
          quantity: "5.000",
          minimumQuantity: "2.000",
        },
        {
          branchId: branchBId,
          supplyId: seedSupplyId,
          quantity: "20.000",
          minimumQuantity: "3.000",
        },
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      if (!prisma) return;

      const supplyIds = [seedSupplyId, createdSupplyId].filter(Boolean);
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: personIds } },
            { entity: "SUPPLY", entityId: { in: supplyIds } },
          ],
        },
      });
      await prisma.supplyStockMovement.deleteMany({
        where: { supplyId: { in: supplyIds } },
      });
      await prisma.supplyStock.deleteMany({
        where: { supplyId: { in: supplyIds } },
      });
      await prisma.supply.deleteMany({ where: { id: { in: supplyIds } } });
      await prisma.userBranch.deleteMany({
        where: {
          userId: { in: personIds },
          branchId: { in: [branchAId, branchBId].filter(Boolean) },
        },
      });
      await prisma.branch.deleteMany({
        where: { id: { in: [branchAId, branchBId].filter(Boolean) } },
      });
      if (unitOfMeasureId) {
        await prisma.unitMeasure.deleteMany({
          where: { id: unitOfMeasureId },
        });
      }
      await prisma.userAccount.deleteMany({
        where: { personId: { in: personIds } },
      });
      await prisma.person.deleteMany({ where: { id: { in: personIds } } });
      if (documentTypeId) {
        await prisma.documentType.deleteMany({
          where: { id: documentTypeId },
        });
      }
    } finally {
      await app?.close();
    }
  }, 30000);

  it("creates a supply for an authorized user and persists it", async () => {
    const name = `Insumo creado e2e ${runId}`;
    const response = await postSupply(
      { name, unitOfMeasureId },
      tokens.BRANCH_LEADER,
    ).expect(201);
    const supply = (
      response.body as {
        data: { id: string; name: string; unitOfMeasure: { id: string } };
      }
    ).data;
    createdSupplyId = supply.id;

    expect(supply).toMatchObject({
      id: expect.any(String),
      name,
      unitOfMeasure: { id: unitOfMeasureId },
      active: true,
    });
    await expect(
      prisma!.supply.findUnique({ where: { id: supply.id } }),
    ).resolves.toMatchObject({ name, unitOfMeasureId });
  });

  it("denies supply creation to a branch assistant and anonymous users", async () => {
    const assistantName = `Insumo no autorizado ${runId}`;
    const denied = await postSupply(
      { name: assistantName, unitOfMeasureId },
      tokens.BRANCH_ASSISTANT,
    ).expect(403);
    expect(errorOf(denied.body).code).toBe("INSUFFICIENT_PERMISSIONS");
    await expect(
      prisma!.supply.findFirst({ where: { name: assistantName } }),
    ).resolves.toBeNull();

    await postSupply({
      name: `Insumo sin token ${runId}`,
      unitOfMeasureId,
    }).expect(401);
  });

  it("lists only the requested branch stock and rejects another branch", async () => {
    const response = await getSupplyStock(
      branchAId,
      tokens.BRANCH_LEADER,
    ).expect(200);
    const rows = (response.body as { data: SupplyStockItem[] }).data;
    const seeded = rows.filter(({ supplyId }) => supplyId === seedSupplyId);

    expect(seeded).toHaveLength(1);
    expect(seeded[0]).toMatchObject({
      supplyId: seedSupplyId,
      branchId: branchAId,
      quantity: "5.000",
      minimumQuantity: "2.000",
    });
    expect(rows.some(({ branchId }) => branchId === branchBId)).toBe(false);

    const denied = await getSupplyStock(branchBId, tokens.BRANCH_LEADER).expect(
      403,
    );
    expect(errorOf(denied.body).code).toBe("BRANCH_SCOPE_VIOLATION");
  });

  it("records a movement and adjusts stock only in the authorized branch", async () => {
    const response = await postMovement(
      {
        branchId: branchAId,
        supplyId: seedSupplyId,
        movementType: "ENTRY",
        quantity: 2,
      },
      tokens.BRANCH_LEADER,
    ).expect(201);
    const movement = (
      response.body as {
        data: {
          id: string;
          movementType: string;
          branch: { id: string };
          supply: { id: string };
        };
      }
    ).data;

    expect(movement).toMatchObject({
      id: expect.any(String),
      movementType: "ENTRY",
      branch: { id: branchAId },
      supply: { id: seedSupplyId },
    });

    const [branchAStock, branchBStock, storedMovement] = await Promise.all([
      prisma!.supplyStock.findUniqueOrThrow({
        where: {
          branchId_supplyId: { branchId: branchAId, supplyId: seedSupplyId },
        },
      }),
      prisma!.supplyStock.findUniqueOrThrow({
        where: {
          branchId_supplyId: { branchId: branchBId, supplyId: seedSupplyId },
        },
      }),
      prisma!.supplyStockMovement.findUnique({
        where: { id: movement.id },
      }),
    ]);

    expect(branchAStock.quantity.toString()).toBe("7");
    expect(branchBStock.quantity.toString()).toBe("20");
    expect(storedMovement).toMatchObject({
      id: movement.id,
      branchId: branchAId,
      supplyId: seedSupplyId,
      userId: actorIds.BRANCH_LEADER,
      movementType: "ENTRY",
    });
    expect(storedMovement?.quantity.toString()).toBe("2");
  });

  it("rejects stock access and movements for an unassigned branch", async () => {
    const movementCountBefore = await prisma!.supplyStockMovement.count({
      where: { branchId: branchBId, supplyId: seedSupplyId },
    });
    const denied = await postMovement(
      {
        branchId: branchBId,
        supplyId: seedSupplyId,
        movementType: "ENTRY",
        quantity: 3,
      },
      tokens.BRANCH_LEADER,
    ).expect(403);

    expect(errorOf(denied.body).code).toBe("BRANCH_SCOPE_VIOLATION");
    expect(
      await prisma!.supplyStockMovement.count({
        where: { branchId: branchBId, supplyId: seedSupplyId },
      }),
    ).toBe(movementCountBefore);
    const branchBStock = await prisma!.supplyStock.findUniqueOrThrow({
      where: {
        branchId_supplyId: { branchId: branchBId, supplyId: seedSupplyId },
      },
    });
    expect(branchBStock.quantity.toString()).toBe("20");
  });
});
