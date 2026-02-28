import { logger } from "../utils/logger.js";
import { alertOnError } from "../utils/alert.js";
import { runHealthCheckAndAlert } from "../services/health-monitor.service.js";

export async function healthCheck(): Promise<void> {
  logger.info("Cron job started: health-check");

  try {
    await runHealthCheckAndAlert();
    logger.info("Cron job completed: health-check");
  } catch (error) {
    await alertOnError("cron:health-check", error);
  }
}
