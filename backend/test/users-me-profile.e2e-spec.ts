import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as argon2 from "argon2";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

const runId = Date.now().toString(36);
const DOCUMENT_CODE = "CC-USERME-E2E";
const CURRENT_PASSWORD = "ProfilePass1!";
const NEW_PASSWORD = "UpdatedPass2!";

interface LoginResponse {
  data: { accessToken: string };
}

interface OwnProfile {
  id: string;
  email: string;
  person: { firstName: string | null };
}

describe("own profile and password flow (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let email: string;
  let personId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const documentType = await prisma.documentType.upsert({
      where: { code: DOCUMENT_CODE },
      update: { active: true },
      create: { code: DOCUMENT_CODE, name: "Documento (e2e perfil)" },
    });
    const role = await prisma.role.upsert({
      where: { name: "BRANCH_ASSISTANT" },
      update: { active: true },
      create: { name: "BRANCH_ASSISTANT" },
    });

    email = `profile.${runId}@e2e.test`;
    const person = await prisma.person.create({
      data: {
        documentTypeId: documentType.id,
        documentNumber: runId,
        phone: "3000000000",
        address: "Calle 1 # 2-3",
        firstName: "Perfil",
        lastName: `E2E ${runId}`,
        email,
        userAccount: {
          create: {
            roleId: role.id,
            active: true,
            mustChangePassword: false,
            password: await argon2.hash(CURRENT_PASSWORD),
          },
        },
      },
    });
    personId = person.id;
  });

  afterAll(async () => {
    if (personId) {
      await prisma.auditLog.deleteMany({ where: { userId: personId } });
      await prisma.userAccount.deleteMany({ where: { personId } });
      await prisma.person.deleteMany({ where: { id: personId } });
    }
    if (prisma) {
      await prisma.documentType.deleteMany({
        where: { code: DOCUMENT_CODE },
      });
      await app.close();
    }
  });

  it("authenticates, reads and updates the profile, then changes the password", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: CURRENT_PASSWORD })
      .expect(200);
    const token = (login.body as LoginResponse).data.accessToken;
    expect(token).toEqual(expect.any(String));

    const profile = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect((profile.body as { data: OwnProfile }).data).toMatchObject({
      id: personId,
      email,
      person: { firstName: "Perfil" },
    });

    const updatedProfile = await request(app.getHttpServer())
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Perfil Actualizado" })
      .expect(200);
    expect((updatedProfile.body as { data: OwnProfile }).data).toMatchObject({
      id: personId,
      person: { firstName: "Perfil Actualizado" },
    });

    const persistedPerson = await prisma.person.findUnique({
      where: { id: personId },
      select: { firstName: true },
    });
    expect(persistedPerson?.firstName).toBe("Perfil Actualizado");

    await request(app.getHttpServer())
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      })
      .expect(200);

    const wrongCurrentPassword = await request(app.getHttpServer())
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: CURRENT_PASSWORD,
        newPassword: "AnotherPass3!",
      })
      .expect(401);
    expect(wrongCurrentPassword.body).toMatchObject({
      error: { code: "INVALID_CREDENTIALS" },
    });
  });
});
