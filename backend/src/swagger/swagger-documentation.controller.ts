import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SwaggerProtectLogInDto } from "@femike/swagger-protect";
import { Public } from "../common/decorators/public.decorator.js";
import { AuthService } from "../modules/auth/auth.service.js";
import type { Response } from "express";

@ApiExcludeController()
@Controller("login-api")
export class SwaggerDocumentationController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() credentials: SwaggerProtectLogInDto,
    @Res() response: Response,
  ) {
    const result = await this.authService.login({
      email: credentials.login,
      password: credentials.password,
    });

    if (result.user.role.name !== "DEV") {
      throw new ForbiddenException();
    }

    return response.json({ token: result.accessToken });
  }
}
