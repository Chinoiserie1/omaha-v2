import { PublicKey } from "@solana/web3.js";
import { logger } from "../utils/logger.js";
import * as vaultRepo from "../store/vault.repository.js";
import * as tokenPriceRepo from "../store/token-price.repository.js";
import { computeSharePrice } from "./share-price.service.js";

export async function fetchAndStoreVaultPrices(): Promise<void> {
  const vaults = await vaultRepo.findAllActiveVaults();
  const eligible = vaults.filter((v) => v.mintAddress);

  const results = await Promise.allSettled(
    eligible.map(async (vault) => {
      const token = await tokenPriceRepo.upsertVaultToken({
        name: vault.vaultName,
        symbol: vault.vaultSymbol,
        decimals: 9,
        mint: vault.mintAddress!,
      });

      const result = await computeSharePrice(new PublicKey(vault.statePda));
      if (result.computedPriceUsd === null) {
        logger.warn({ vaultId: vault.id }, "Share price unavailable, skipping");
        return;
      }

      await tokenPriceRepo.insertPrice(token.id, result.computedPriceUsd);
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result && result.status === "rejected") {
      logger.error(
        { err: result.reason, vaultId: eligible[i]?.id },
        "Failed to store vault price",
      );
    }
  }
}
