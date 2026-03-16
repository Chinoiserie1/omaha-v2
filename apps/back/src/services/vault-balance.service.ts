import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getConnection, USDC_MINT } from "../solana/config.js";
import { logger } from "../utils/logger.js";

/**
 * Read the vault's USDC (base token) balance from on-chain.
 * Returns the raw token amount as bigint (6 decimals for USDC).
 */
export async function getVaultBaseBalance(
  statePda: PublicKey,
  baseTokenAta?: string | null,
): Promise<bigint> {
  const connection = getConnection();

  const vaultBaseAta = baseTokenAta
    ? new PublicKey(baseTokenAta)
    : getAssociatedTokenAddressSync(
        USDC_MINT,
        statePda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

  try {
    const balance = await connection.getTokenAccountBalance(vaultBaseAta);
    const rawBalance = BigInt(balance.value.amount);

    logger.debug(
      {
        statePda: statePda.toBase58(),
        vaultBaseAta: vaultBaseAta.toBase58(),
        balance: rawBalance.toString(),
      },
      "Vault base token balance fetched",
    );

    return rawBalance;
  } catch {
    // Account doesn't exist or is invalid — treat as zero balance
    logger.warn(
      { statePda: statePda.toBase58() },
      "Could not fetch vault base token balance — treating as 0",
    );
    return 0n;
  }
}

/**
 * Compute the base tokens that would be returned for a given share burn.
 * Mirrors the on-chain math: shares * price / 10^decimals, minus exit fee.
 */
export function computeBaseToReturn(
  shares: bigint,
  sharePrice: bigint,
  shareDecimals: number,
  exitFeeBps: number,
): bigint {
  const shareMultiplier = 10n ** BigInt(shareDecimals);
  const grossBase = (shares * sharePrice) / shareMultiplier;

  if (grossBase === 0n) return 0n;

  if (exitFeeBps > 0) {
    const fee = (grossBase * BigInt(exitFeeBps)) / 10_000n;
    return grossBase - fee;
  }

  return grossBase;
}
