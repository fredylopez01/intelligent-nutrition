import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

type RoleName = "SUPERADMIN" | "BRANCH_LEADER";

interface BranchBody {
  id: string;
  active: boolean;
  openNow: boolean;
  schedule: {
    dayOfWeek: number;
    intervals: { opensAt: string; closesAt: string }[];
  }[];
}

const runId = Date.now().toString(36);
const DOCUMENT_CODE = "CC-BRSCH-E2E";
const lunchBreak = [
  { opensAt: "08:00", closesAt: "13:00" },
  { opensAt: "15:00", closesAt: "20:00" },
];
const everyDay = Array.from({ length: 7 }, (_, index) => ({
  dayOfWeek: index + 1,
  intervals: [{ opensAt: "00:00", closesAt: "23:59" }],
}));

describe("Branch schedule (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let branchId = "";
  const tokens = {} as Record<RoleName, string>;
  const personIds: string[] = [];

  const putSchedule = (body: object, token?: string) => {
    const pending = request(app.getHttpServer()).put(
      `/api/v1/branches/${branchId}/schedule`,
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

    const documentTypeId = (
      await prisma.documentType.upsert({
        where: { code: DOCUMENT_CODE },
        update: { active: true },
        create: { code: DOCUMENT_CODE, name: "Documento (e2e horario)" },
      })
    ).id;
    branchId = (
      await prisma.branch.create({
        data: { name: `${runId} Sede horario`, address: "Calle 1", phone: "1" },
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
          phone: "3000000000",
          address: "Calle 1 # 2-3",
          firstName: roleName,
          lastName: "Horario E2E",
          email: `${roleName.toLowerCase()}.schedule.${runId}@e2e.test`,
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

  afterAll(async () => {
    if (prisma) {
      await prisma.auditLog.deleteMany({ where: { entityId: branchId } });
      await prisma.branch.deleteMany({ where: { id: branchId } });
      await prisma.userAccount.deleteMany({
        where: { personId: { in: personIds } },
      });
      await prisma.person.deleteMany({ where: { id: { in: personIds } } });
      await prisma.documentType.deleteMany({ where: { code: DOCUMENT_CODE } });
      await app.close();
    }
  }, 30000);

  it("starts closed every day", async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/v1/branches/${branchId}`,
    );

    expect(response.status).toBe(200);
    const body = (response.body as { data: BranchBody }).data;
    expect(body.openNow).toBe(false);
    expect(body.schedule).toHaveLength(7);
    expect(body.schedule.every((day) => day.intervals.length === 0)).toBe(true);
  });

  it("lets the superadmin replace the week with a lunch break", async () => {
    const response = await putSchedule(
      {
        days: [
          { dayOfWeek: 1, intervals: lunchBreak },
          {
            dayOfWeek: 6,
            intervals: [{ opensAt: "09:00", closesAt: "14:00" }],
          },
        ],
      },
      tokens.SUPERADMIN,
    );

    expect(response.status).toBe(200);
    const body = (response.body as { data: BranchBody }).data;
    expect(body.schedule[0]).toEqual({ dayOfWeek: 1, intervals: lunchBreak });
    expect(body.schedule[5].intervals).toHaveLength(1);
    expect(body.schedule[6].intervals).toEqual([]);
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: branchId, entity: "BRANCH" },
    });
    expect(audit?.reason).toContain("horario");
  });

  it("shows the schedule and openNow in the public list", async () => {
    await putSchedule({ days: everyDay }, tokens.SUPERADMIN);

    const response = await request(app.getHttpServer()).get(
      `/api/v1/branches?search=${runId}`,
    );

    expect(response.status).toBe(200);
    const [branch] = (response.body as { data: BranchBody[] }).data;
    expect(branch.id).toBe(branchId);
    expect(branch.schedule[3].intervals).toEqual([
      { opensAt: "00:00", closesAt: "23:59" },
    ]);
    expect(typeof branch.openNow).toBe("boolean");
  });

  it("is closed while the branch is inactive", async () => {
    await prisma.branch.update({
      where: { id: branchId },
      data: { active: false },
    });

    const response = await request(app.getHttpServer()).get(
      `/api/v1/branches/${branchId}`,
    );

    expect((response.body as { data: BranchBody }).data.openNow).toBe(false);
    await prisma.branch.update({
      where: { id: branchId },
      data: { active: true },
    });
  });

  it.each([
    [{ days: [{ dayOfWeek: 8, intervals: [] }] }, undefined],
    [
      {
        days: [
          { dayOfWeek: 1, intervals: [{ opensAt: "8:00", closesAt: "13:00" }] },
        ],
      },
      undefined,
    ],
    [
      {
        days: [
          {
            dayOfWeek: 1,
            intervals: [{ opensAt: "14:00", closesAt: "13:00" }],
          },
        ],
      },
      "INVALID_INTERVAL",
    ],
    [
      {
        days: [
          {
            dayOfWeek: 1,
            intervals: [
              { opensAt: "08:00", closesAt: "14:00" },
              { opensAt: "13:30", closesAt: "18:00" },
            ],
          },
        ],
      },
      "OVERLAPPING_INTERVALS",
    ],
    [
      {
        days: [
          { dayOfWeek: 2, intervals: [] },
          { dayOfWeek: 2, intervals: [] },
        ],
      },
      "DUPLICATED_DAY",
    ],
  ])("rejects an invalid schedule (%#)", async (body, code) => {
    const response = await putSchedule(body, tokens.SUPERADMIN);

    expect(response.status).toBe(400);
    if (code) {
      expect((response.body as { error: { code: string } }).error.code).toBe(
        code,
      );
    }
  });

  it("does not let a branch leader change the schedule", async () => {
    const response = await putSchedule({ days: [] }, tokens.BRANCH_LEADER);

    expect(response.status).toBe(403);
  });

  it("asks for a token", async () => {
    const response = await putSchedule({ days: [] });

    expect(response.status).toBe(401);
  });
});
