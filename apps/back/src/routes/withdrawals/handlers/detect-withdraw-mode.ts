import { PublicKey } from "@solana/web3.js";
import { findPendingWithdrawPda } from "@repo/omaha-programs-sdk";
import * as vaultRepo from "../../../store/vault.repository.js";
import { getConnection } from "../../../solana/config.js";
import { logger } from "../../../utils/logger.js";

/**
 * Detect if the confirmed withdrawal was instant (WithdrawWithPrice)
 * by checking whether the PendingWithdraw PDA exists on-chain.
 *
 * - PDA does NOT exist → instant (WithdrawWithPrice doesn't create one)
 * - PDA exists → queued (RequestWithdraw creates one)
 *
 * Uses the same "confirmed" commitment as the tx confirmation above it,
 * so PDA state is consistent with the confirmed transaction.
 */
export async function detectInstantMode(
  vaultId: string,
  walletAddress: string | null,
): Promise<boolean> {
  if (!walletAddress) return false;

  try {
    const vault = await vaultRepo.findVaultById(vaultId);
    if (!vault?.statePda) return false;

    const statePda = new PublicKey(vault.statePda);
    const withdrawer = new PublicKey(walletAddress);
    const [pendingWithdraw] = findPendingWithdrawPda(statePda, withdrawer);

    const connection = getConnection();
    const accountInfo = await connection.getAccountInfo(pendingWithdraw);

    return accountInfo === null;
  } catch (err) {
    logger.warn({ err }, "Failed to detect withdrawal mode, defaulting to queued");
    return false;
  }
}
