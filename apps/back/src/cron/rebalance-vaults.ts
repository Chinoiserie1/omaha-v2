import { logger } from "../utils/logger.js";
import { alertOnError } from "../utils/alert.js";
import { env } from "../utils/env.js";
import { rebalanceAllVaults } from "../services/rebalancer.service.js";

export async function rebalanceVaults(): Promise<void> {
  logger.info("Cron job started: rebalance-vaults");

  if (!env.SOLANA_RPC_URL) {
    logger.error("SOLANA_RPC_URL is required for vault rebalancing — skipping");
    return;
  }
  if (!env.ADMIN_PROGRAM_PRIVATE_KEY) {
    logger.error("ADMIN_PROGRAM_PRIVATE_KEY is required for vault rebalancing — skipping");
    return;
  }

  logger.info({ dryRun: env.REBALANCE_DRY_RUN }, "Rebalance mode");

  try {
    await rebalanceAllVaults();
    logger.info("Cron job completed: rebalance-vaults");
  } catch (error) {
    await alertOnError("cron:rebalance-vaults", error);
  }
}
