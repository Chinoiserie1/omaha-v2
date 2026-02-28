import { logger } from "../utils/logger.js";
import { alertOnError } from "../utils/alert.js";
import { syncAllKols } from "../services/kol.service.js";

export async function fetchTweets(): Promise<void> {
  logger.info("Cron job started: fetch-tweets");

  try {
    await syncAllKols();
    logger.info("Cron job completed: fetch-tweets");
  } catch (error) {
    await alertOnError("cron:fetch-tweets", error);
  }
}
