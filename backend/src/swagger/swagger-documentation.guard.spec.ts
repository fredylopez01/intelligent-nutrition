import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../database/prisma/prisma.service.js";
import { SwaggerDocumentationGuard } from "./swagger-documentation.guard.js";

describe("SwaggerDocumentationGuard", () => {
  let guard: SwaggerDocumentationGuard;
  let verifyAsync: jest.Mock;
  let findUnique: jest.Mock;

  beforeEach(async () => {
    verifyAsync = jest.fn().mockResolvedValue({ sub: "dev-user" });
    findUnique = jest.fn().mockResolvedValue({
      active: true,
      person: { active: true },
      role: { name: "DEV", active: true },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwaggerDocumentationGuard,
        { provide: JwtService, useValue: { verifyAsync } },
        {
          provide: PrismaService,
          useValue: { userAccount: { findUnique } },
        },
      ],
    }).compile();

    guard = module.get(SwaggerDocumentationGuard);
  });

  it("allows an active DEV user with a valid token", async () => {
    await expect(guard.canActivate("valid-token")).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { personId: "dev-user" } }),
    );
  });

  it("rejects users without the DEV role", async () => {
    findUnique.mockResolvedValue({
      active: true,
      person: { active: true },
      role: { name: "ADMIN", active: true },
    });

    await expect(guard.canActivate("valid-token")).resolves.toBe(false);
  });

  it("rejects invalid tokens without querying the database", async () => {
    verifyAsync.mockRejectedValue(new Error("invalid token"));

    await expect(guard.canActivate("invalid-token")).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
