import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { prisma } from "@repo/database";
import { getGlamClient } from "../solana/client.js";
import { getConnection } from "../solana/config.js";
import * as vaultRepo from "../store/vault.repository.js";
import * as withdrawalRepo from "../store/withdrawal.repository.js";
import { logger } from "../utils/logger.js";

/**
 * Check if a claim was already consumed on-chain by verifying
 * there is no pending redemption request for this wallet.
 */
export async function checkClaimConsumedOnChain(
  statePda: string,
  walletAddress: string,
): Promise<boolean> {
  const glamClient = getGlamClient(new PublicKey(statePda));
  const walletPubkey = new PublicKey(walletAddress);

  try {
    const pending = await glamClient.invest.fetchPendingRequest(walletPubkey);

    if (!pending) return true;

    const reqType = pending.requestType;
    if (typeof reqType === "object" && reqType !== null) {
      return !("redemption" in reqType);
    }

    return true;
  } catch {
    // fetchPendingRequest throws when no account exists → claim consumed
    return true;
  }
}

export type ClaimResult =
  | { kind: "transaction"; transaction: string; withdrawalId: string }
  | { kind: "already_claimed"; withdrawalId: string };

/**
 * Build an unsigned claim transaction for the user to sign.
 * Only works for CLAIMABLE withdrawal requests.
 *
 * If the on-chain claim was already consumed (e.g. previous tx landed
 * but backend didn't record it), auto-transitions DB to CLAIMED.
 */
export async function buildClaimTransaction(
  withdrawalId: string,
  signerPublicKey: string,
): Promise<ClaimResult> {
  logger.info(
    { withdrawalId, signer: signerPublicKey },
    "Building claim transaction",
  );

  const withdrawal = await withdrawalRepo.findById(withdrawalId);
  if (!withdrawal) {
    logger.error({ withdrawalId }, "Withdrawal request not found");
    throw new Error("Withdrawal request not found");
  }
  if (withdrawal.status !== "CLAIMABLE") {
    logger.error(
      { withdrawalId, status: withdrawal.status },
      "Cannot claim withdrawal in current status",
    );
    throw new Error(
      `Cannot claim withdrawal in status "${withdrawal.status}"`,
    );
  }

  const vault = await vaultRepo.findVaultById(withdrawal.vaultId);
  if (!vault?.statePda) {
    logger.error(
      { withdrawalId, vaultId: withdrawal.vaultId },
      "Vault not found or missing state PDA",
    );
    throw new Error("Vault not found or missing state PDA");
  }

  const signerPubkey = new PublicKey(signerPublicKey);
  const statePda = new PublicKey(vault.statePda);
  const glamClient = getGlamClient(statePda);
  const connection = getConnection();

  let claimIx;
  try {
    claimIx = await glamClient.invest.txBuilder.claimIx(
      null,
      signerPubkey,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes("No eligible request")) {
      logger.warn(
        { withdrawalId, signer: signerPublicKey },
        "claimIx failed with 'No eligible request' — checking on-chain state",
      );

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
          "On-chain claim already consumed — auto-transitioning to CLAIMED",
        );
        await withdrawalRepo.updateStatus(withdrawalId, "CLAIMED", {
          claimedAt: new Date(),
        });
        return { kind: "already_claimed", withdrawalId };
      }
    }

    throw err;
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    claimIx,
  );
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = signerPubkey;

  // No keeper signature needed — user signs this tx
  const serialized = transaction
    .serialize({ requireAllSignatures: false })
    .toString("base64");

  logger.info(
    { withdrawalId, signer: signerPublicKey },
    "Claim transaction built successfully",
  );

  return { kind: "transaction", transaction: serialized, withdrawalId };
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
    logger.error({ withdrawalId }, "Withdrawal request not found for claim confirmation");
    throw new Error("Withdrawal request not found");
  }
  if (withdrawal.status !== "CLAIMABLE") {
    logger.error(
      { withdrawalId, status: withdrawal.status },
      "Cannot confirm claim for current status",
    );
    throw new Error(
      `Cannot confirm claim for status "${withdrawal.status}"`,
    );
  }

  // Wait for tx to land on-chain (same pattern as confirm-redeem)
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const confirmation = await connection.confirmTransaction(
    { signature: txSignature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  if (confirmation.value.err) {
    logger.error(
      { withdrawalId, txSignature, onChainError: confirmation.value.err },
      "Claim transaction failed on-chain",
    );
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
