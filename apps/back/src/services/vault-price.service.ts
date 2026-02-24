import { PublicKey } from "@solana/web3.js";
import { logger } from "../utils/logger.js";
import * as vaultRepo from "../store/vault.repository.js";
import * as tokenPriceRepo from "../store/token-price.repository.js";
import { getSharePrice } from "../solana/vault-holdings.js";

export async function fetchAndStoreVaultPrices(): Promise<void> {
  const vaults = await vaultRepo.findAllActiveVaults();

  for (const vault of vaults) {
    if (!vault.mintAddress) continue;

    try {
      const token = await tokenPriceRepo.upsertVaultToken({
        name: vault.vaultName,
        symbol: vault.vaultSymbol,
        decimals: 9,
        mint: vault.mintAddress,
      });

      const sharePrice = await getSharePrice(new PublicKey(vault.statePda));
      if (sharePrice === null) {
        logger.warn({ vaultId: vault.id }, "Share price unavailable, skipping");
        continue;
      }

      await tokenPriceRepo.insertPrice(token.id, sharePrice);
      logger.info(
        { vaultId: vault.id, sharePrice },
        "Stored vault share price",
      );
    } catch (err) {
      logger.error({ err, vaultId: vault.id }, "Failed to store vault price");
    }
  }
}
