import { fetchAndStorePrices } from "../services/token-price.service.js";
import { fetchAndStoreVaultPrices } from "../services/vault-price.service.js";

export async function fetchPrices(): Promise<void> {
  logger.debug("Running token price fetch cron");
  await fetchAndStorePrices();
  await fetchAndStoreVaultPrices();
}
