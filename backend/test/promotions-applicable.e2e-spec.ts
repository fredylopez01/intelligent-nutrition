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

const APPLICABLE_PATH = "/api/v1/promotions/applicable";
const runId = Date.now().toString(36);
const DOCUMENT_CODE = "CC-PROM-APP-E2E";

describe("GET /promotions/applicable (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const personIds: string[] = [];
  const tokens = {} as Record<TestRole, string>;
  const promotionIds: string[] = [];

  const getApplicable = (token?: string) => {
    const pending = request(app.getHttpServer()).get(APPLICABLE_PATH);
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
          name: "Documento (e2e promociones aplicables)",
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
          lastName: "Applicable Promotion E2E",
          email: `${roleName.toLowerCase()}.applicable-promo.${runId}@e2e.test`,
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

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const day = 24 * 60 * 60 * 1000;
    const created = await Promise.all(
      [
        { name: `E2E vigente ${runId}`, startDate: null, endDate: null },
        {
          name: `E2E vencida ${runId}`,
          startDate: new Date(today.getTime() - 10 * day),
          endDate: new Date(today.getTime() - day),
        },
        {
          name: `E2E futura ${runId}`,
          startDate: new Date(today.getTime() + day),
          endDate: new Date(today.getTime() + 10 * day),
        },
      ].map((promotion) =>
        prisma.promotion.create({
          data: {
            ...promotion,
            discountPercentage: "5.00",
            active: false,
            createdById: personIds[0],
          },
          select: { id: true },
        }),
      ),
    );
    promotionIds.push(...created.map((promotion) => promotion.id));
  });

  afterAll(async () => {
    if (prisma) {
      if (promotionIds.length > 0) {
        await prisma.promotion.deleteMany({
          where: { id: { in: promotionIds } },
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
    const response = await getApplicable().expect(401);

    expect((response.body as ApiError).error.code).toEqual(expect.any(String));
  });

  it.each(ROLES)(
    "lists only the promotions valid today to %s",
    async (role) => {
      const response = await getApplicable(tokens[role]).expect(200);
      const names = (response.body as { data: { name: string }[] }).data.map(
        (promotion) => promotion.name,
      );

      expect(names).toContain(`E2E vigente ${runId}`);
      expect(names).not.toContain(`E2E vencida ${runId}`);
      expect(names).not.toContain(`E2E futura ${runId}`);
    },
  );

  it("returns each promotion with the contract shape", async () => {
    const response = await getApplicable(tokens.BRANCH_ASSISTANT).expect(200);
    const promotion = (
      response.body as { data: Record<string, unknown>[] }
    ).data.find((item) => item.name === `E2E vigente ${runId}`);

    expect(promotion).toMatchObject({
      id: promotionIds[0],
      discountPercentage: "5.00",
      startDate: null,
      endDate: null,
      active: false,
    });
  });
});
