import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../common/interfaces/AuthenticatedUser.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { ActivateAccountDto } from "./dto/activate.dto.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { ResendActivationDto } from "./dto/resend-activation.dto.js";
import { ForgotPasswordDto } from "./dto/forgot-password.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";
import { GoogleAuthGuard } from "./guards/google-auth.guard.js";
import type { GoogleOAuthUser } from "./strategies/google.strategy.js";
import { ThrottlerGuard } from "@nestjs/throttler";

function getGoogleErrorCode(error: unknown) {
  if (!(error instanceof HttpException)) {
    return "GOOGLE_AUTH_FAILED";
  }

  const response = error.getResponse();
  if (typeof response === "object" && response !== null && "code" in response) {
    const code = response.code;
    if (
      code === "GOOGLE_EMAIL_NOT_REGISTERED" ||
      code === "GOOGLE_ACCOUNT_INACTIVE" ||
      code === "ROLE_INACTIVE"
    ) {
      return code;
    }
  }

  return "GOOGLE_AUTH_FAILED";
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: "Log in with email and password",
    description:
      "Authenticates a user and returns a Bearer access token together with the basic data of the account. Public endpoint.",
  })
  @ApiResponse({
    status: 200,
    description: "Authenticated; the access token is returned.",
  })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({
    status: 401,
    description: "Wrong email or password (INVALID_CREDENTIALS).",
  })
  @ApiResponse({
    status: 429,
    description: "Too many login attempts from this IP address.",
  })
  @ApiResponse({
    status: 403,
    description:
      "The account or its role is inactive, or the account has not been activated (ACCOUNT_INACTIVE, ROLE_INACTIVE, ACCOUNT_NOT_ACTIVATED).",
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get("google")
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: "Start the Google sign-in",
    description:
      "Redirects the browser to Google to authenticate. It is meant to be opened by the browser, not called as an API. Public endpoint.",
  })
  @ApiResponse({
    status: 302,
    description: "Redirect to the Google consent screen.",
  })
  googleLogin() {}

  @Get("google/callback")
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: "Finish the Google sign-in",
    description:
      "Callback used by Google. It redirects to the frontend with the access token in the URL fragment (accessToken), or to the login page with an authError query parameter (GOOGLE_EMAIL_NOT_REGISTERED, GOOGLE_ACCOUNT_INACTIVE, ROLE_INACTIVE, GOOGLE_AUTH_FAILED). Public endpoint.",
  })
  @ApiResponse({
    status: 302,
    description:
      "Redirect to the frontend, either authenticated or with an authError.",
  })
  async googleLoginCallback(
    @Req() request: Request & { user: GoogleOAuthUser },
    @Res() response: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

    try {
      const { accessToken } = await this.authService.loginWithGoogle(
        request.user.email,
      );
      const callbackUrl = new URL("/auth/google/callback", frontendUrl);
      callbackUrl.hash = new URLSearchParams({ accessToken }).toString();
      return response.redirect(callbackUrl.toString());
    } catch (error) {
      const loginUrl = new URL("/login", frontendUrl);
      loginUrl.searchParams.set("authError", getGoogleErrorCode(error));
      return response.redirect(loginUrl.toString());
    }
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get the authenticated user",
    description:
      "Returns the account of the user that owns the access token: identity, role and assigned branches. Any authenticated user.",
  })
  @ApiResponse({ status: 200, description: "Authenticated user." })
  @ApiResponse({
    status: 401,
    description:
      "Missing, invalid or expired access token, or user not authorized.",
  })
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post("activate")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Activate an account",
    description:
      "Sets the first password of an account using the activation token received by email. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Account activated." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid request body, or the activation token is invalid or expired (INVALID_ACTIVATION_TOKEN).",
  })
  @ApiResponse({
    status: 403,
    description: "The account is inactive (ACCOUNT_INACTIVE).",
  })
  @ApiResponse({
    status: 409,
    description:
      "The account is already activated (ACCOUNT_ALREADY_ACTIVATED).",
  })
  activate(@Body() activateAccountDto: ActivateAccountDto) {
    return this.authService.activateAccount(activateAccountDto);
  }

  @Post("forgot-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Request a password reset",
    description:
      "Sends a password reset link to the email when an active account exists. The response is always the same, so it does not reveal whether the email is registered. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Generic confirmation message." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post("reset-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset the password",
    description:
      "Sets a new password using the reset token received by email. Public endpoint.",
  })
  @ApiResponse({ status: 200, description: "Password reset." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid request body, or the reset token is invalid or expired (INVALID_PASSWORD_RESET_TOKEN).",
  })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Change the own password",
    description:
      "Changes the password of the authenticated user. Any authenticated user.",
  })
  @ApiResponse({ status: 200, description: "Password changed." })
  @ApiResponse({
    status: 400,
    description:
      "Invalid request body, or the new password equals the current one (PASSWORDS_ARE_EQUAL).",
  })
  @ApiResponse({
    status: 401,
    description:
      "Missing or invalid access token, or wrong current password (INVALID_CREDENTIALS).",
  })
  @ApiResponse({
    status: 403,
    description: "The account has not been activated (ACCOUNT_NOT_ACTIVATED).",
  })
  @ApiResponse({
    status: 404,
    description: "User account not found (USER_NOT_FOUND).",
  })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, changePasswordDto);
  }

  @Post("resend")
  @Roles("SUPERADMIN", "DEV")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Resend the activation email",
    description:
      "Generates a new activation token and sends it to an account that has not been activated yet. Roles: SUPERADMIN, DEV.",
  })
  @ApiResponse({ status: 200, description: "Activation email sent." })
  @ApiResponse({ status: 400, description: "Invalid request body." })
  @ApiResponse({ status: 401, description: "Missing or invalid access token." })
  @ApiResponse({
    status: 403,
    description:
      "Role not allowed, or the account is inactive (ACCOUNT_INACTIVE).",
  })
  @ApiResponse({
    status: 404,
    description: "User account not found (USER_NOT_FOUND).",
  })
  @ApiResponse({
    status: 409,
    description:
      "The account is already activated (ACCOUNT_ALREADY_ACTIVATED).",
  })
  resendActivation(@Body() resendActivationDto: ResendActivationDto) {
    return this.authService.resendActivation(resendActivationDto);
  }
}
