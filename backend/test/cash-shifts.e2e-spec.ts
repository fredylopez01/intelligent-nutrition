import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { PrismaService } from "../src/database/prisma/prisma.service.js";

type RoleName = "SUPERADMIN" | "BRANCH_LEADER" | "BRANCH_ASSISTANT";

interface ShiftResponse {
  id: string;
  branch: { id: string; name: string };
  user: { id: string; fullName: string };
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: string;
  closingAmount: string | null;
  observation: string | null;
}

interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string };
}

const runId = randomUUID().replace(/-/g, "").slice(0, 12);
const errorOf = (body: unknown) =>
  (body as ApiResponse<unknown>).error!;

describe("POST /api/v1/cash-shifts (open) (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let branchId: string;
  let documentTypeId: string;
  const tokens = {} as Record<RoleName, string>;
  const actorIds: string[] = [];

  const openShift = (body: object, token?: string) => {
    const req = request(app.getHttpServer()).post("/api/v1/cash-shifts");
    if (token) req.set("Authorization", `Bearer ${token}`);
    return req.send(body);
  };

  const validPayload = (overrides: Partial<{ branchId: string; openingAmount: string }> = {}) => ({
    branchId: overrides.branchId ?? branchId,
    openingAmount: overrides.openingAmount ?? "50000.00",
    observation: "Apertura turno mañana",
  });

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
      await prisma.documentType.upsert({
        where: { code: `CS-E2E-${runId}` },
        update: { active: true },
        create: { code: `CS-E2E-${runId}`, name: "Doc e2e caja" },
      })
    ).id;

    const branch = await prisma.branch.create({
      data: { name: `Sede e2e caja ${runId}`, address: "Calle 1 # 2-3", phone: "6017000001", active: true },
    });
    branchId = branch.id;

    let seq = 0;
    for (const roleName of ["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const) {
      seq += 1;
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: { active: true },
        create: { name: roleName },
      });
      const person = await prisma.person.create({
        data: {
          documentTypeId,
          documentNumber: `${runId}-open-${seq}`,
          firstName: roleName,
          lastName: "CajaE2E",
          email: `${roleName.toLowerCase()}.caja.open.${runId}@e2e.test`,
          phone: "3009990000",
          address: "Calle 1 # 1-1",
          userAccount: {
            create: { roleId: role.id, active: true, mustChangePassword: false },
          },
        },
      });
      actorIds.push(person.id);
      tokens[roleName] = await jwtService.signAsync({ sub: person.id });

      if (roleName !== "SUPERADMIN") {
        await prisma.userBranch.create({
          data: { userId: person.id, branchId, assignmentDate: new Date(), active: true },
        });
      }
    }
  }, 30000);

  afterAll(async () => {
    try {
      const shiftIds = (
        await prisma.cashShift.findMany({
          where: { userId: { in: actorIds } },
          select: { id: true },
        })
      ).map(({ id }) => id);

      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: actorIds } }, { entityId: { in: shiftIds } }],
        },
      });
      await prisma.cashShift.deleteMany({ where: { id: { in: shiftIds } } });
      await prisma.userBranch.deleteMany({ where: { userId: { in: actorIds } } });
      await prisma.userAccount.deleteMany({ where: { personId: { in: actorIds } } });
      await prisma.person.deleteMany({ where: { id: { in: actorIds } } });
      await prisma.branch.deleteMany({ where: { id: branchId } });
      await prisma.documentType.deleteMany({ where: { id: documentTypeId } });
    } finally {
      await app?.close();
    }
  }, 30000);

  it("opens a shift and persists it in the database", async () => {
    const response = await openShift(validPayload(), tokens.BRANCH_LEADER).expect(201);
    const shift = (response.body as ShiftResponse);

    expect(shift).toMatchObject({
      id: expect.any(String),
      branch: { id: branchId },
      status: "OPEN",
      openingAmount: "50000.00",
      closingAmount: null,
      closedAt: null,
    });

    const persisted = await prisma.cashShift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(persisted.status).toBe("OPEN");
    expect(persisted.openingAmount.toFixed(2)).toBe("50000.00");
  });

  it("returns 409 SHIFT_ALREADY_OPEN when the same user tries to open a second shift", async () => {
    // First open (may already be open from previous test)
    await openShift(validPayload(), tokens.BRANCH_ASSISTANT);
    // Second attempt must conflict
    const response = await openShift(validPayload(), tokens.BRANCH_ASSISTANT).expect(409);
    expect(errorOf(response.body).code).toBe("SHIFT_ALREADY_OPEN");
  });

  it("returns 400 when openingAmount has wrong format", async () => {
    await openShift(
      { branchId, openingAmount: "50000" },
      tokens.BRANCH_LEADER,
    ).expect(400);
  });

  it("returns 401 when no authentication token is provided", async () => {
    await openShift(validPayload()).expect(401);
  });

  it("returns 403 when SUPERADMIN tries to open (role not allowed)", async () => {
    const response = await openShift(validPayload(), tokens.SUPERADMIN).expect(403);
    expect(errorOf(response.body).code).toBe("INSUFFICIENT_PERMISSIONS");
  });
});

describe("PATCH /api/v1/cash-shifts/:id/close (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let branchId: string;
  let documentTypeId: string;
  const tokens = {} as Record<RoleName, string>;
  const actorIds: string[] = [];

  const closeShift = (shiftId: string, body: object, token?: string) => {
    const req = request(app.getHttpServer()).patch(`/api/v1/cash-shifts/${shiftId}/close`);
    if (token) req.set("Authorization", `Bearer ${token}`);
    return req.send(body);
  };

  const createOpenShift = (userId: string) =>
    prisma.cashShift.create({
      data: { branchId, userId, openingAmount: "80000.00", status: "OPEN" },
    });

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
      await prisma.documentType.upsert({
        where: { code: `CS-CLOSE-${runId}` },
        update: { active: true },
        create: { code: `CS-CLOSE-${runId}`, name: "Doc e2e cierre" },
      })
    ).id;

    const branch = await prisma.branch.create({
      data: { name: `Sede e2e cierre ${runId}`, address: "Calle 2 # 3-4", phone: "6017000002", active: true },
    });
    branchId = branch.id;

    let seq = 0;
    for (const roleName of ["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const) {
      seq += 1;
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: { active: true },
        create: { name: roleName },
      });
      const person = await prisma.person.create({
        data: {
          documentTypeId,
          documentNumber: `${runId}-close-${seq}`,
          firstName: roleName,
          lastName: "CierrE2E",
          email: `${roleName.toLowerCase()}.caja.close.${runId}@e2e.test`,
          phone: "3009991111",
          address: "Calle 2 # 2-2",
          userAccount: {
            create: { roleId: role.id, active: true, mustChangePassword: false },
          },
        },
      });
      actorIds.push(person.id);
      tokens[roleName] = await jwtService.signAsync({ sub: person.id });

      if (roleName !== "SUPERADMIN") {
        await prisma.userBranch.create({
          data: { userId: person.id, branchId, assignmentDate: new Date(), active: true },
        });
      }
    }
  }, 30000);

  afterAll(async () => {
    try {
      const shiftIds = (
        await prisma.cashShift.findMany({
          where: { userId: { in: actorIds } },
          select: { id: true },
        })
      ).map(({ id }) => id);

      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: actorIds } }, { entityId: { in: shiftIds } }],
        },
      });
      await prisma.cashShift.deleteMany({ where: { id: { in: shiftIds } } });
      await prisma.userBranch.deleteMany({ where: { userId: { in: actorIds } } });
      await prisma.userAccount.deleteMany({ where: { personId: { in: actorIds } } });
      await prisma.person.deleteMany({ where: { id: { in: actorIds } } });
      await prisma.branch.deleteMany({ where: { id: branchId } });
      await prisma.documentType.deleteMany({ where: { id: documentTypeId } });
    } finally {
      await app?.close();
    }
  }, 30000);

  it("closes an open shift and persists openingAmount and closingAmount", async () => {
    const leaderActorId = actorIds[1]; // BRANCH_LEADER is seq=2 → index 1
    const shift = await createOpenShift(leaderActorId);

    const response = await closeShift(
      shift.id,
      { closingAmount: "380000.00" },
      tokens.BRANCH_LEADER,
    ).expect(200);

    const result = response.body as ShiftResponse;
    expect(result).toMatchObject({
      id: shift.id,
      status: "CLOSED",
      openingAmount: "80000.00",
      closingAmount: "380000.00",
    });
    expect(result.closedAt).not.toBeNull();

    const persisted = await prisma.cashShift.findUniqueOrThrow({ where: { id: shift.id } });
    expect(persisted.status).toBe("CLOSED");
    expect(persisted.closingAmount?.toFixed(2)).toBe("380000.00");
  });

  it("returns 409 SHIFT_ALREADY_CLOSED when closing an already closed shift", async () => {
    const leaderActorId = actorIds[1];
    const shift = await prisma.cashShift.create({
      data: {
        branchId,
        userId: leaderActorId,
        openingAmount: "10000.00",
        closingAmount: "10000.00",
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    const response = await closeShift(
      shift.id,
      { closingAmount: "10000.00" },
      tokens.BRANCH_LEADER,
    ).expect(409);
    expect(errorOf(response.body).code).toBe("SHIFT_ALREADY_CLOSED");
  });

  it("returns 403 SHIFT_OWNER_REQUIRED when a non-owner BRANCH_ASSISTANT tries to close another user's shift", async () => {
    const leaderActorId = actorIds[1];
    const shift = await createOpenShift(leaderActorId);

    const response = await closeShift(
      shift.id,
      { closingAmount: "380000.00" },
      tokens.BRANCH_ASSISTANT,
    ).expect(403);
    expect(errorOf(response.body).code).toBe("SHIFT_OWNER_REQUIRED");
  });

  it("returns 403 when SUPERADMIN tries to close (endpoint only allows BRANCH_LEADER and BRANCH_ASSISTANT)", async () => {
    const leaderActorId = actorIds[1];
    const shift = await createOpenShift(leaderActorId);

    const response = await closeShift(
      shift.id,
      { closingAmount: "250000.00" },
      tokens.SUPERADMIN,
    ).expect(403);
    expect(errorOf(response.body).code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("returns 404 when the shift does not exist", async () => {
    await closeShift(
      randomUUID(),
      { closingAmount: "380000.00" },
      tokens.BRANCH_LEADER,
    ).expect(404);
  });

  it("returns 401 when no authentication token is provided", async () => {
    const shift = await createOpenShift(actorIds[1]);
    await closeShift(shift.id, { closingAmount: "380000.00" }).expect(401);
  });
});

describe("GET /api/v1/cash-shifts (history) (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let branchId: string;
  let documentTypeId: string;
  const tokens = {} as Record<RoleName, string>;
  const actorIds: string[] = [];

  const getShifts = (query: Record<string, string | number> = {}, token?: string) => {
    const req = request(app.getHttpServer()).get("/api/v1/cash-shifts").query(query);
    if (token) req.set("Authorization", `Bearer ${token}`);
    return req;
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
      await prisma.documentType.upsert({
        where: { code: `CS-LIST-${runId}` },
        update: { active: true },
        create: { code: `CS-LIST-${runId}`, name: "Doc e2e lista caja" },
      })
    ).id;

    const branch = await prisma.branch.create({
      data: { name: `Sede e2e lista ${runId}`, address: "Calle 3 # 4-5", phone: "6017000003", active: true },
    });
    branchId = branch.id;

    let seq = 0;
    for (const roleName of ["SUPERADMIN", "BRANCH_LEADER", "BRANCH_ASSISTANT"] as const) {
      seq += 1;
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: { active: true },
        create: { name: roleName },
      });
      const person = await prisma.person.create({
        data: {
          documentTypeId,
          documentNumber: `${runId}-list-${seq}`,
          firstName: roleName,
          lastName: "ListaE2E",
          email: `${roleName.toLowerCase()}.caja.list.${runId}@e2e.test`,
          phone: "3009992222",
          address: "Calle 3 # 3-3",
          userAccount: {
            create: { roleId: role.id, active: true, mustChangePassword: false },
          },
        },
      });
      actorIds.push(person.id);
      tokens[roleName] = await jwtService.signAsync({ sub: person.id });

      if (roleName !== "SUPERADMIN") {
        await prisma.userBranch.create({
          data: { userId: person.id, branchId, assignmentDate: new Date(), active: true },
        });
      }
    }

    // Seed two shifts for the branch so list tests have data
    await prisma.cashShift.createMany({
      data: [
        { branchId, userId: actorIds[1], openingAmount: "50000.00", status: "OPEN" },
        {
          branchId,
          userId: actorIds[1],
          openingAmount: "60000.00",
          closingAmount: "480000.00",
          status: "CLOSED",
          closedAt: new Date(),
        },
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      const shiftIds = (
        await prisma.cashShift.findMany({
          where: { userId: { in: actorIds } },
          select: { id: true },
        })
      ).map(({ id }) => id);

      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: actorIds } }, { entityId: { in: shiftIds } }],
        },
      });
      await prisma.cashShift.deleteMany({ where: { id: { in: shiftIds } } });
      await prisma.userBranch.deleteMany({ where: { userId: { in: actorIds } } });
      await prisma.userAccount.deleteMany({ where: { personId: { in: actorIds } } });
      await prisma.person.deleteMany({ where: { id: { in: actorIds } } });
      await prisma.branch.deleteMany({ where: { id: branchId } });
      await prisma.documentType.deleteMany({ where: { id: documentTypeId } });
    } finally {
      await app?.close();
    }
  }, 30000);

  it("SUPERADMIN receives paginated shift history with correct meta", async () => {
    const response = await getShifts({ branchId, limit: 20, page: 1 }, tokens.SUPERADMIN).expect(200);
    const body = response.body as { data: ShiftResponse[]; meta: { total: number; totalPages: number; page: number; limit: number } };

    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.meta).toMatchObject({ page: 1, limit: 20 });
    expect(body.meta.total).toBeGreaterThanOrEqual(2);
    expect(body.meta.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("BRANCH_LEADER can list shifts scoped to their assigned branch", async () => {
    const response = await getShifts({ branchId, page: 1, limit: 20 }, tokens.BRANCH_LEADER).expect(200);
    const body = response.body as { data: ShiftResponse[] };
    expect(Array.isArray(body.data)).toBe(true);
    for (const shift of body.data) {
      expect(shift.branch.id).toBe(branchId);
    }
  });

  it("returns 403 BRANCH_SCOPE_VIOLATION when BRANCH_LEADER omits branchId", async () => {
    const response = await getShifts({ page: 1, limit: 20 }, tokens.BRANCH_LEADER).expect(403);
    expect(errorOf(response.body).code).toBe("BRANCH_SCOPE_VIOLATION");
  });

  it("returns 403 BRANCH_SCOPE_VIOLATION when BRANCH_LEADER requests a branch they are not assigned to", async () => {
    const foreignBranch = await prisma.branch.create({
      data: { name: `Sede ajena ${runId}`, address: "Cr 5 # 6-7", phone: "6017000004", active: true },
    });

    try {
      const response = await getShifts(
        { branchId: foreignBranch.id, page: 1, limit: 20 },
        tokens.BRANCH_LEADER,
      ).expect(403);
      expect(errorOf(response.body).code).toBe("BRANCH_SCOPE_VIOLATION");
    } finally {
      await prisma.branch.delete({ where: { id: foreignBranch.id } });
    }
  });

  it("returns 403 when BRANCH_ASSISTANT tries to list shifts (role not allowed)", async () => {
    const response = await getShifts(
      { branchId, page: 1, limit: 20 },
      tokens.BRANCH_ASSISTANT,
    ).expect(403);
    expect(errorOf(response.body).code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("returns 401 when no authentication token is provided", async () => {
    await getShifts({ page: 1, limit: 20 }).expect(401);
  });
});
