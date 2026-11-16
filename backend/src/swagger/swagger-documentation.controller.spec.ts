import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import type { Response } from "express";
import { AuthService } from "../modules/auth/auth.service.js";
import { SwaggerDocumentationController } from "./swagger-documentation.controller.js";

describe("SwaggerDocumentationController", () => {
  let controller: SwaggerDocumentationController;
  let login: jest.Mock;

  beforeEach(async () => {
    login = jest.fn().mockResolvedValue({
      accessToken: "dev-token",
      user: { role: { name: "DEV" } },
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SwaggerDocumentationController],
      providers: [{ provide: AuthService, useValue: { login } }],
    }).compile();

    controller = module.get(SwaggerDocumentationController);
  });

  it("returns an access token after authenticating a DEV user", async () => {
    const response = {
      json: jest.fn().mockReturnValue({ token: "dev-token" }),
    } as unknown as Response;

    await expect(
      controller.login(
        { login: "dev@example.com", password: "password" },
        response,
      ),
    ).resolves.toEqual({ token: "dev-token" });
    expect(response.json).toHaveBeenCalledWith({ token: "dev-token" });
    expect(login).toHaveBeenCalledWith({
      email: "dev@example.com",
      password: "password",
    });
  });

  it("rejects authenticated users without the DEV role", async () => {
    login.mockResolvedValue({
      accessToken: "non-dev-token",
      user: { role: { name: "ADMIN" } },
    });

    const response = { json: jest.fn() } as unknown as Response;

    await expect(
      controller.login(
        { login: "admin@example.com", password: "password" },
        response,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
