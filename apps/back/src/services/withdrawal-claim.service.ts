import { PublicKey } from "@solana/web3.js";
import { prisma } from "@repo/database";
import { findPendingWithdrawPda } from "@repo/omaha-programs-sdk";
import { getConnection } from "../solana/config.js";
import * as vaultRepo from "../store/vault.repository.js";
import * as withdrawalRepo from "../store/withdrawal.repository.js";
import { logger } from "../utils/logger.js";

/**
 * Check if a withdrawal was already consumed on-chain by verifying
 * the pending withdraw PDA no longer exists (closed by FulfillWithdraw).
 */
export async function checkClaimConsumedOnChain(
  statePda: string,
  walletAddress: string,
): Promise<boolean> {
  const connection = getConnection();
  const vaultStatePda = new PublicKey(statePda);
  const withdrawer = new PublicKey(walletAddress);

  const [pendingWithdrawPda] = findPendingWithdrawPda(vaultStatePda, withdrawer);

  const accountInfo = await connection.getAccountInfo(pendingWithdrawPda);

  // If account doesn't exist, the withdrawal was fulfilled (PDA closed)
  return accountInfo === null;
}

export type ClaimResult =
  | { kind: "transaction"; transaction: string; withdrawalId: string }
  | { kind: "already_claimed"; withdrawalId: string };

/**
 * In the custom vault, FulfillWithdraw transfers base tokens directly
 * and closes the pending PDA — there is no separate claim step.
 *
 * This function checks if the withdrawal was already fulfilled on-chain
 * and auto-transitions to CLAIMED if so.
 */
export async function buildClaimTransaction(
  withdrawalId: string,
  signerPublicKey: string,
): Promise<ClaimResult> {
  logger.info(
    { withdrawalId, signer: signerPublicKey },
    "Checking claim status (custom vault — no separate claim tx)",
  );

  const withdrawal = await withdrawalRepo.findById(withdrawalId);
  if (!withdrawal) {
    throw new Error("Withdrawal request not found");
  }

  // Already claimed
  if (withdrawal.status === "CLAIMED") {
    return { kind: "already_claimed", withdrawalId };
  }

  // For custom vault, CLAIMABLE should not exist, but handle gracefully
  if (withdrawal.status !== "CLAIMABLE" && withdrawal.status !== "PROCESSING") {
    throw new Error(
      `Cannot claim withdrawal in status "${withdrawal.status}"`,
    );
  }

  const vault = await vaultRepo.findVaultById(withdrawal.vaultId);
  if (!vault?.statePda) {
    throw new Error("Vault not found or missing state PDA");
  }

  // Check on-chain: if pending PDA is gone, the fulfill already transferred tokens
  const user = await prisma.user.findUnique({
    where: { id: withdrawal.userId },
  });
  const walletAddress = user?.walletAddress ?? signerPublicKey;

  const consumed = await checkClaimConsumedOnChain(
    vault.statePda,
    walletAddress,
  );

  if (consumed) {
    logger.info(
      { withdrawalId },
      "Withdrawal already fulfilled on-chain — auto-transitioning to CLAIMED",
    );
    await withdrawalRepo.updateStatus(withdrawalId, "CLAIMED", {
      claimedAt: new Date(),
    });
    return { kind: "already_claimed", withdrawalId };
  }

  // Pending PDA still exists — fulfillment hasn't happened yet
  throw new Error(
    "Withdrawal has not been fulfilled yet. Please wait for the admin to process your withdrawal.",
  );
}

/**
 * Confirm a claim by verifying the tx signature on-chain
 * and transitioning the withdrawal to CLAIMED.
 */
export async function confirmClaim(
  withdrawalId: string,
  txSignature: string,
): Promise<void> {
  logger.info(
    { withdrawalId, txSignature },
    "Confirming claim transaction on-chain",
  );

  const withdrawal = await withdrawalRepo.findById(withdrawalId);
  if (!withdrawal) {
    throw new Error("Withdrawal request not found");
  }

  // Accept both CLAIMABLE and PROCESSING (custom vault skips CLAIMABLE)
  if (withdrawal.status !== "CLAIMABLE" && withdrawal.status !== "PROCESSING") {
    throw new Error(
      `Cannot confirm claim for status "${withdrawal.status}"`,
    );
  }

  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const confirmation = await connection.confirmTransaction(
    { signature: txSignature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(
      `Claim transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  await withdrawalRepo.updateStatus(withdrawalId, "CLAIMED", {
    claimTxSignature: txSignature,
    claimedAt: new Date(),
  });

  logger.info({ withdrawalId, txSignature }, "Withdrawal claimed successfully");
}
