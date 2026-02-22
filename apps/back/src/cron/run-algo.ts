import axios from "axios";
import { logger } from "../utils/logger.js";
import { syncTradeableAssets } from "../services/jupiter.service.js";
import { synthesizeAllKols } from "../services/thesis.service.js";

export async function runAlgo(): Promise<void> {
  logger.info("Cron job started: run-algo");

  try {
    const synced = await syncTradeableAssets();
    logger.info({ synced }, "Tradeable assets synced");

    await synthesizeAllKols();
    logger.info("Cron job completed: run-algo");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          body: error.response?.data,
        },
        "Cron job failed: run-algo"
      );
    } else {
      logger.error({ err: error }, "Cron job failed: run-algo");
    }
  }
}
