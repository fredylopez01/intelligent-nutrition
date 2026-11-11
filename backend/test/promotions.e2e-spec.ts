import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

type TestRole = "SUPERADMIN" | "BRANCH_LEADER";

interface ApiError {
  error: { code: string };
}

interface PromotionResponse {
  data: {
    id: string;
    name: string;
    discountPercentage: string;
    active: boolean;
    startDate: string | null;
    endDate: string | null;
  };
}

interface PromotionsListResponse {
  data: PromotionResponse["data"][];
  meta: { total: number };
}

const runId = Date.now().toString(36);
const DOCUMENT_CODE = "CC-PROM-E2E";
const NAME_PREFIX = `E2E ${runId}`;

describe("promotions endpoints (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let documentTypeId: string;
  const personIds: string[] = [];
  const promotionIds: string[] = [];
  const tokens = {} as Record<TestRole, string>;

  const auth = (
    method: "get" | "post" | "patch",
    path: string,
    token?: string,
  ) => {
    const pending = request(app.getHttpServer())[method](path);
    if (token) pending.set("Authorization", `Bearer ${token}`);
    return pending;
  };

  const createPromotion = (token: string, body: object) =>
    auth("post", "/api/v1/promotions", token).send(body);

  const createBody = (name: string, startDate: string, endDate: string) => ({
    name,
    discountPercentage: "15.00",
    startDate,
    endDate,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    documentTypeId = (
      await prisma.documentType.upsert({
        where: { code: DOCUMENT_CODE },
        update: { active: true },
        create: { code: DOCUMENT_CODE, name: "Documento (e2e promociones)" },
      })
    ).id;

    const jwtService = app.get(JwtService);
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
          documentTypeId,
          documentNumber: `${runId}${index}`,
          firstName: roleName,
          lastName: "Promotions E2E",
          email: `${roleName.toLowerCase()}.promotions.${runId}@e2e.test`,
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
  });

  afterAll(async () => {
    if (prisma) {
      if (personIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { userId: { in: personIds } },
        });
      }
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

  it("creates a promotion successfully", async () => {
    const response = await createPromotion(
      tokens.SUPERADMIN,
      createBody(`${NAME_PREFIX} exito`, "2097-01-01", "2097-01-31"),
    ).expect(201);
    const promotion = (response.body as PromotionResponse).data;
    promotionIds.push(promotion.id);

    expect(promotion).toMatchObject({
      name: `${NAME_PREFIX} exito`,
      discountPercentage: "15.00",
      startDate: "2097-01-01",
      endDate: "2097-01-31",
      active: false,
    });
  });

  it("rejects a promotion whose date range overlaps an existing promotion", async () => {
    const first = await createPromotion(
      tokens.SUPERADMIN,
      createBody(
        `${NAME_PREFIX} overlap existente`,
        "2098-03-01",
        "2098-03-31",
      ),
    ).expect(201);
    promotionIds.push((first.body as PromotionResponse).data.id);

    const response = await createPromotion(
      tokens.SUPERADMIN,
      createBody(
        `${NAME_PREFIX} overlap rechazado`,
        "2098-03-15",
        "2098-04-15",
      ),
    ).expect(409);

    expect((response.body as ApiError).error.code).toBe(
      "PROMOTION_DATE_RANGE_OVERLAP",
    );
  });

  it("lists promotions and returns the active-promotion endpoint", async () => {
    const listResponse = await auth(
      "get",
      "/api/v1/promotions",
      tokens.SUPERADMIN,
    )
      .query({ search: NAME_PREFIX, limit: 100 })
      .expect(200);
    const list = listResponse.body as PromotionsListResponse;
    expect(
      list.data.some((promotion) => promotion.name === `${NAME_PREFIX} exito`),
    ).toBe(true);
    expect(list.meta.total).toBeGreaterThanOrEqual(2);

    const activeResponse = await auth(
      "get",
      "/api/v1/promotions/active",
      tokens.BRANCH_LEADER,
    ).expect(200);
    expect(activeResponse.body).toHaveProperty("data");
  });

  it("updates an inactive promotion", async () => {
    const promotion = await prisma.promotion.findUniqueOrThrow({
      where: { id: promotionIds[0] },
      select: { id: true },
    });
    const response = await auth(
      "patch",
      `/api/v1/promotions/${promotion.id}`,
      tokens.SUPERADMIN,
    )
      .send({ name: `${NAME_PREFIX} actualizado`, discountPercentage: "20.00" })
      .expect(200);

    expect((response.body as PromotionResponse).data).toMatchObject({
      id: promotion.id,
      name: `${NAME_PREFIX} actualizado`,
      discountPercentage: "20.00",
    });
  });

  it("restricts creation, listing, and updates to SUPERADMIN", async () => {
    await createPromotion(
      tokens.BRANCH_LEADER,
      createBody(`${NAME_PREFIX} no autorizado`, "2099-01-01", "2099-01-31"),
    ).expect(403);

    await auth("get", "/api/v1/promotions", tokens.BRANCH_LEADER).expect(403);

    await auth(
      "patch",
      `/api/v1/promotions/${promotionIds[0]}`,
      tokens.BRANCH_LEADER,
    )
      .send({ name: `${NAME_PREFIX} modificacion rechazada` })
      .expect(403);
  });
});
