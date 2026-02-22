import axios from "axios";
import { logger } from "../utils/logger.js";
import { env } from "../utils/env.js";
import { rebalanceAllKolVaults } from "../services/rebalancer.service.js";

export async function rebalanceVaults(): Promise<void> {
  logger.info("Cron job started: rebalance-vaults");

  if (!env.SOLANA_RPC_URL) {
    logger.error("SOLANA_RPC_URL is required for vault rebalancing — skipping");
    return;
  }
  if (!env.KEEPER_PRIVATE_KEY) {
    logger.error("KEEPER_PRIVATE_KEY is required for vault rebalancing — skipping");
    return;
  }

  logger.info({ dryRun: env.REBALANCE_DRY_RUN }, "Rebalance mode");

  try {
    await rebalanceAllKolVaults();
    logger.info("Cron job completed: rebalance-vaults");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          body: error.response?.data,
        },
        "Cron job failed: rebalance-vaults"
      );
    } else {
      logger.error({ err: error }, "Cron job failed: rebalance-vaults");
    }
  }
}
