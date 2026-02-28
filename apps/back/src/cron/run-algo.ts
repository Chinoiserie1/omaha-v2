import { logger } from "../utils/logger.js";
import { alertOnError } from "../utils/alert.js";
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
    await alertOnError("cron:run-algo", error);
  }
}
