import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { SwaggerGuardInterface } from "@femike/swagger-protect";
import { PrismaService } from "../database/prisma/prisma.service.js";

@Injectable()
export class SwaggerDocumentationGuard implements SwaggerGuardInterface {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(token: string): Promise<boolean> {
    let payload: { sub?: string };

    try {
      payload = await this.jwtService.verifyAsync<{ sub?: string }>(token);
    } catch {
      return false;
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return false;
    }

    const user = await this.prisma.userAccount.findUnique({
      where: { personId: payload.sub },
      select: {
        active: true,
        person: { select: { active: true } },
        role: { select: { name: true, active: true } },
      },
    });

    return Boolean(
      user &&
      user.active &&
      user.person.active &&
      user.role.active &&
      user.role.name === "DEV",
    );
  }
}
