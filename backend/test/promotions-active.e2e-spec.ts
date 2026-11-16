import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

const ROLES = [
  "SUPERADMIN",
  "DEV",
  "BRANCH_LEADER",
  "BRANCH_ASSISTANT",
] as const;

type TestRole = (typeof ROLES)[number];

interface ApiError {
  error: { code: string; message: string };
}

const ACTIVE_PATH = "/api/v1/promotions/active";
const runId = Date.now().toString(36);
const DOCUMENT_CODE = "CC-PROM-ACT-E2E";

describe("GET /promotions/active visibility (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const personIds: string[] = [];
  const tokens = {} as Record<TestRole, string>;
  let previouslyActiveIds: string[] = [];
  let promotionId: string | undefined;

  const getActive = (token?: string) => {
    const pending = request(app.getHttpServer()).get(ACTIVE_PATH);
    if (token) pending.set("Authorization", `Bearer ${token}`);
    return pending;
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
        create: {
          code: DOCUMENT_CODE,
          name: "Documento (e2e promoción activa)",
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
          lastName: "Active Promotion E2E",
          email: `${roleName.toLowerCase()}.active-promo.${runId}@e2e.test`,
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
    }

    const previouslyActive = await prisma.promotion.findMany({
      where: { active: true },
      select: { id: true },
    });
    previouslyActiveIds = previouslyActive.map((promotion) => promotion.id);
    if (previouslyActiveIds.length > 0) {
      await prisma.promotion.updateMany({
        where: { id: { in: previouslyActiveIds } },
        data: { active: false },
      });
    }
  });

  afterAll(async () => {
    if (prisma) {
      if (promotionId) {
        await prisma.promotion.deleteMany({ where: { id: promotionId } });
      }
      if (previouslyActiveIds.length > 0) {
        await prisma.promotion.updateMany({
          where: { id: { in: previouslyActiveIds } },
          data: { active: true },
        });
      }
      if (personIds.length > 0) {
        await prisma.userAccount.deleteMany({
          where: { personId: { in: personIds } },
        });
        await prisma.person.deleteMany({
          where: { id: { in: personIds } },
        });
      }
      await prisma.documentType.deleteMany({
        where: { code: DOCUMENT_CODE },
      });
      await app.close();
    }
  });

  it("rejects the request without a token", async () => {
    const response = await getActive().expect(401);

    expect((response.body as ApiError).error).toEqual(
      expect.objectContaining({
        code: expect.any(String),
        message: expect.any(String),
      }),
    );
  });

  it("rejects an invalid token", async () => {
    await getActive("not-a-jwt").expect(401);
  });

  it.each(ROLES)(
    "returns data null to %s when there is no active promotion",
    async (role) => {
      const response = await getActive(tokens[role]).expect(200);

      expect(response.body).toEqual({ data: null });
    },
  );

  it.each(ROLES)(
    "returns the active promotion with the contract shape to %s",
    async (role) => {
      if (!promotionId) {
        const promotion = await prisma.promotion.create({
          data: {
            name: `E2E activa ${runId}`,
            discountPercentage: "12.50",
            active: true,
            createdById: personIds[0],
          },
          select: { id: true },
        });
        promotionId = promotion.id;
      }

      const response = await getActive(tokens[role]).expect(200);
      const body = response.body as { data: Record<string, unknown> };

      expect(Object.keys(body.data).sort()).toEqual(
        [
          "active",
          "createdAt",
          "discountPercentage",
          "endDate",
          "id",
          "name",
          "startDate",
          "updatedAt",
        ].sort(),
      );
      expect(body.data).toMatchObject({
        id: promotionId,
        name: `E2E activa ${runId}`,
        discountPercentage: "12.50",
        startDate: null,
        endDate: null,
        active: true,
      });
      expect(new Date(body.data.createdAt as string).toISOString()).toBe(
        body.data.createdAt,
      );
    },
  );

  it("keeps the rest of the promotions endpoints for the superadmin only", async () => {
    for (const role of ["DEV", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const) {
      await request(app.getHttpServer())
        .get("/api/v1/promotions")
        .set("Authorization", `Bearer ${tokens[role]}`)
        .expect(403);
    }
  });
});
