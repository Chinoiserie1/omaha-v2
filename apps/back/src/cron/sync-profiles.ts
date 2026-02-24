import axios from "axios";
import { logger } from "../utils/logger.js";
import { syncAllKolProfiles } from "../services/kol.service.js";

export async function syncProfiles(): Promise<void> {
  logger.info("Cron job started: sync-profiles");

  try {
    await syncAllKolProfiles();
    logger.info("Cron job completed: sync-profiles");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          body: error.response?.data,
        },
        "Cron job failed: sync-profiles"
      );
    } else {
      logger.error({ err: error }, "Cron job failed: sync-profiles");
    }
  }
}
