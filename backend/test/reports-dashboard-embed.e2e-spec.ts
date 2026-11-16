import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

type RoleName = "SUPERADMIN" | "BRANCH_LEADER" | "BRANCH_ASSISTANT";

interface ApiError {
  error: { code: string; message: string };
}

const ENDPOINT = "/api/v1/reports/dashboard-embed";
const VARIABLE = "BI_DASHBOARD_EMBED_URL";
const EMBED_URL =
  "https://lookerstudio.google.com/embed/reporting/e2e-report/page/e2e-page";
const runId = Date.now().toString(36);

describe("GET /api/v1/reports/dashboard-embed (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let documentTypeId = "";
  const personIds: string[] = [];
  const tokens = {} as Record<RoleName, string>;
  const originalValue = process.env[VARIABLE];

  const get = (token?: string) => {
    const pending = request(app.getHttpServer()).get(ENDPOINT);
    if (token) pending.set("Authorization", `Bearer ${token}`);
    return pending;
  };

  const setVariable = (value: string | undefined) => {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, VARIABLE);
    } else {
      process.env[VARIABLE] = value;
    }
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
        data: { code: `CC-EMB-${runId}`, name: "Document (e2e dashboard)" },
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
          email: `${roleName.toLowerCase()}.embed.${runId}@e2e.test`,
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
  }, 30000);

  afterEach(() => {
    setVariable(originalValue);
  });

  afterAll(async () => {
    setVariable(originalValue);
    try {
      await prisma?.userAccount.deleteMany({
        where: { personId: { in: personIds } },
      });
      await prisma?.person.deleteMany({ where: { id: { in: personIds } } });
      await prisma?.documentType.deleteMany({ where: { id: documentTypeId } });
    } finally {
      await app?.close();
    }
  }, 30000);

  describe("access control", () => {
    it("requires authentication", async () => {
      setVariable(EMBED_URL);

      await get().expect(401);
    });

    it.each(["BRANCH_LEADER", "BRANCH_ASSISTANT"] as const)(
      "forbids the %s role and does not leak the URL",
      async (roleName) => {
        setVariable(EMBED_URL);

        const response = await get(tokens[roleName]).expect(403);

        expect((response.body as ApiError).error.code).toBe(
          "INSUFFICIENT_PERMISSIONS",
        );
        expect(JSON.stringify(response.body)).not.toContain(EMBED_URL);
      },
    );
  });

  describe("when the dashboard is configured", () => {
    it("returns the embed URL to the superadmin", async () => {
      setVariable(EMBED_URL);

      const response = await get(tokens.SUPERADMIN).expect(200);

      expect(response.body).toEqual({ data: { url: EMBED_URL } });
    });

    it("returns the URL without the surrounding whitespace", async () => {
      setVariable(`  ${EMBED_URL}  `);

      const response = await get(tokens.SUPERADMIN).expect(200);

      expect(response.body).toEqual({ data: { url: EMBED_URL } });
    });

    it("reads the variable on every request", async () => {
      setVariable(EMBED_URL);
      await get(tokens.SUPERADMIN).expect(200);

      setVariable(undefined);
      await get(tokens.SUPERADMIN).expect(503);
    });
  });

  describe("when the dashboard is not configured", () => {
    it.each([
      ["is missing", undefined],
      ["is empty", ""],
      ["only has spaces", "   "],
      ["is not https", "http://lookerstudio.google.com/embed/reporting/x"],
      ["is not a URL", "not a url"],
    ])(
      "answers 503 DASHBOARD_NOT_CONFIGURED when the variable %s",
      async (_label, value) => {
        setVariable(value);

        const response = await get(tokens.SUPERADMIN).expect(503);

        expect((response.body as ApiError).error.code).toBe(
          "DASHBOARD_NOT_CONFIGURED",
        );
      },
    );
  });
});
