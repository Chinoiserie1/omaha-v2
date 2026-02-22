import axios from "axios";
import { logger } from "../utils/logger.js";
import { syncAllKols } from "../services/kol.service.js";

export async function fetchTweets(): Promise<void> {
  logger.info("Cron job started: fetch-tweets");

  try {
    await syncAllKols();
    logger.info("Cron job completed: fetch-tweets");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          body: error.response?.data,
        },
        "Cron job failed: fetch-tweets"
      );
    } else {
      logger.error({ err: error }, "Cron job failed: fetch-tweets");
    }
  }
}
