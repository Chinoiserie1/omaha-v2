import { logger } from "../utils/logger.js";
import { alertOnError } from "../utils/alert.js";
import { syncAllQuants } from "../services/quant.service.js";

export async function fetchTweets(): Promise<void> {
  logger.info("Cron job started: fetch-tweets");

  try {
    await syncAllQuants();
    logger.info("Cron job completed: fetch-tweets");
  } catch (error) {
    await alertOnError("cron:fetch-tweets", error);
  }
}
