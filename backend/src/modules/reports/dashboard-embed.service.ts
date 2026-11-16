import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const DASHBOARD_EMBED_URL_VARIABLE = "BI_DASHBOARD_EMBED_URL";

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

@Injectable()
export class DashboardEmbedService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns the embed URL of the Looker Studio report. The value lives in the
   * environment, not in the frontend bundle. A missing, blank or non-https value
   * is treated as "not configured" so a typo never reaches the iframe.
   */
  getEmbedUrl(): { url: string } {
    const configured = this.configService
      .get<string>(DASHBOARD_EMBED_URL_VARIABLE)
      ?.trim();

    if (!configured || !isHttpsUrl(configured)) {
      throw new ServiceUnavailableException({
        code: "DASHBOARD_NOT_CONFIGURED",
        message: "The analytics dashboard is not configured on this server.",
      });
    }

    return { url: configured };
  }
}
