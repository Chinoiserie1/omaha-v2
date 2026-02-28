import { logger } from "../utils/logger.js";
import { alertOnError } from "../utils/alert.js";
import { syncAllKolProfiles } from "../services/kol.service.js";

export async function syncProfiles(): Promise<void> {
  logger.info("Cron job started: sync-profiles");

  try {
    await syncAllKolProfiles();
    logger.info("Cron job completed: sync-profiles");
  } catch (error) {
    await alertOnError("cron:sync-profiles", error);
  }
}
