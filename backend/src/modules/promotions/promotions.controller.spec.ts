import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "@jest/globals";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { PromotionsController } from "./promotions.controller.js";

describe("PromotionsController authorization", () => {
  const guard = new RolesGuard(new Reflector());

  function contextFor(
    role: string,
    handler: keyof PromotionsController,
  ): ExecutionContext {
    const handlerFunction = Object.getOwnPropertyDescriptor(
      PromotionsController.prototype,
      handler,
    )?.value as () => void;

    return {
      getHandler: () => handlerFunction,
      getClass: () => PromotionsController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { active: true, role: { name: role } },
        }),
      }),
    } as ExecutionContext;
  }

  it("allows the roles specified for the active promotion endpoint", () => {
    for (const role of [
      "DEV",
      "SUPERADMIN",
      "BRANCH_LEADER",
      "BRANCH_ASSISTANT",
    ]) {
      expect(guard.canActivate(contextFor(role, "findActive"))).toBe(true);
    }
  });

  it("restricts the promotion list to SUPERADMIN", () => {
    expect(guard.canActivate(contextFor("SUPERADMIN", "findAll"))).toBe(true);
    expect(() =>
      guard.canActivate(contextFor("BRANCH_LEADER", "findAll")),
    ).toThrow(ForbiddenException);
  });
});
