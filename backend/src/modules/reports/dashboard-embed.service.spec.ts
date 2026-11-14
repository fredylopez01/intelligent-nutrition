import { jest, describe, beforeEach, it, expect } from "@jest/globals";
import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import {
  DASHBOARD_EMBED_URL_VARIABLE,
  DashboardEmbedService,
} from "./dashboard-embed.service.js";

const EMBED_URL =
  "https://lookerstudio.google.com/embed/reporting/report-id/page/page-id";

describe("DashboardEmbedService", () => {
  let service: DashboardEmbedService;
  const configGet = jest.fn<(key: string) => string | undefined>();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        DashboardEmbedService,
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();
    service = module.get(DashboardEmbedService);
  });

  const expectNotConfigured = () => {
    try {
      service.getEmbedUrl();
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        code: "DASHBOARD_NOT_CONFIGURED",
        message: "The analytics dashboard is not configured on this server.",
      });
      return;
    }
    throw new Error("Expected DASHBOARD_NOT_CONFIGURED to be thrown");
  };

  it("reads the URL from the configured environment variable", () => {
    configGet.mockReturnValue(EMBED_URL);

    expect(service.getEmbedUrl()).toEqual({ url: EMBED_URL });
    expect(configGet).toHaveBeenCalledWith(DASHBOARD_EMBED_URL_VARIABLE);
  });

  it("returns the URL without the surrounding whitespace", () => {
    configGet.mockReturnValue(`  ${EMBED_URL}\n`);

    expect(service.getEmbedUrl()).toEqual({ url: EMBED_URL });
  });

  it("answers DASHBOARD_NOT_CONFIGURED when the variable is missing", () => {
    configGet.mockReturnValue(undefined);

    expectNotConfigured();
  });

  it("answers DASHBOARD_NOT_CONFIGURED when the variable is empty", () => {
    configGet.mockReturnValue("");

    expectNotConfigured();
  });

  it("answers DASHBOARD_NOT_CONFIGURED when the variable only has spaces", () => {
    configGet.mockReturnValue("   ");

    expectNotConfigured();
  });

  it.each([
    ["a plain http URL", "http://lookerstudio.google.com/embed/reporting/x"],
    ["a javascript URL", "javascript:alert(1)"],
    ["text that is not a URL", "not a url"],
    ["a URL without protocol", "lookerstudio.google.com/embed/reporting/x"],
  ])("answers DASHBOARD_NOT_CONFIGURED for %s", (_label, value) => {
    configGet.mockReturnValue(value);

    expectNotConfigured();
  });
});
