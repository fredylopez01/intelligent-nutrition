import { Module, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { afterAll, beforeAll, describe, it, jest } from "@jest/globals";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

const request = (await import("supertest")).default;

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useValue: {
        login: jest
          .fn<() => Promise<{ accessToken: string }>>()
          .mockResolvedValue({ accessToken: "test" }),
      },
    },
  ],
})
class AuthRateLimitTestModule {}

describe("AuthController login rate limit", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AuthRateLimitTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows five attempts per minute and rejects the next attempt", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(baseUrl)
        .post("/auth/login")
        .send({ email: "user@example.com", password: "wrong" })
        .expect(200);
    }

    await request(baseUrl)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "wrong" })
      .expect(429);
  });
});
