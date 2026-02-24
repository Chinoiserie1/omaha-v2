import { fetchAndStorePrices } from "../services/token-price.service.js";
import { fetchAndStoreVaultPrices } from "../services/vault-price.service.js";
import { logger } from "../utils/logger.js";

export async function fetchPrices(): Promise<void> {
  logger.info("Running token price fetch cron");
  await fetchAndStorePrices();
  await fetchAndStoreVaultPrices();
}
