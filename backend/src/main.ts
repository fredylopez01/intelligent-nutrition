import { createRequire } from "node:module";
import { dirname } from "node:path";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { registerExpressProtectSwagger } from "@femike/swagger-protect";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";
import { SwaggerDocumentationGuard } from "./swagger/swagger-documentation.guard.js";

type SwaggerRequest = Omit<Request, "cookies"> & {
  cookies?: Record<string, unknown>;
};

const SWAGGER_LOGIN_PAGE = "/login-api/index.html";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  configureApp(app);

  const swaggerGuard = app.get(SwaggerDocumentationGuard);
  registerExpressProtectSwagger(app, {
    guard: swaggerGuard,
    swaggerPath: "api/docs",
    loginPath: SWAGGER_LOGIN_PAGE,
    cookieKey: "swagger_token",
  });

  app.use(
    "/api/docs",
    (request: SwaggerRequest, response: Response, next: NextFunction) => {
      const cookieToken = request.cookies?.swagger_token;
      const token = typeof cookieToken === "string" ? cookieToken : "";

      void swaggerGuard
        .canActivate(token)
        .then((hasAccess) => {
          if (hasAccess) {
            next();
            return;
          }

          response.redirect(
            `${SWAGGER_LOGIN_PAGE}?backUrl=${encodeURIComponent("/api/docs")}`,
          );
        })
        .catch((error: unknown) => next(error));
    },
  );

  const require = createRequire(import.meta.url);
  const swaggerProtectUiPath = dirname(
    require.resolve("@femike/swagger-protect-ui"),
  );
  app.use("/login-api", express.static(swaggerProtectUiPath));

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Intelligent Nutrition API")
    .setVersion("1.0")
    .addServer(process.env.API_BASE_URL ?? "http://localhost:3000")
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, "0.0.0.0");
}
void bootstrap();
