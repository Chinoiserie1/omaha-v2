import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { getGlamClient } from "../solana/client.js";
import { getConnection } from "../solana/config.js";
import * as vaultRepo from "../store/vault.repository.js";
import * as withdrawalRepo from "../store/withdrawal.repository.js";
import { logger } from "../utils/logger.js";

/**
 * Build an unsigned claim transaction for the user to sign.
 * Only works for CLAIMABLE withdrawal requests.
 */
export async function buildClaimTransaction(
  withdrawalId: string,
  signerPublicKey: string,
): Promise<{ transaction: string; withdrawalId: string }> {
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

  const vault = await vaultRepo.findVaultById(withdrawal.kolVaultId);
  if (!vault?.statePda) {
    logger.error(
      { withdrawalId, kolVaultId: withdrawal.kolVaultId },
      "Vault not found or missing state PDA",
    );
    throw new Error("Vault not found or missing state PDA");
  }

  const signerPubkey = new PublicKey(signerPublicKey);
  const statePda = new PublicKey(vault.statePda);
  const glamClient = getGlamClient(statePda);
  const connection = getConnection();

  const claimIx = await glamClient.invest.txBuilder.claimIx(
    null,
    signerPubkey,
  );

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

  return { transaction: serialized, withdrawalId };
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

  // Verify tx exists on-chain
  const connection = getConnection();
  const txInfo = await connection.getTransaction(txSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!txInfo) {
    logger.error(
      { withdrawalId, txSignature },
      "Claim transaction not found on-chain",
    );
    throw new Error("Transaction not found on-chain");
  }
  if (txInfo.meta?.err) {
    logger.error(
      { withdrawalId, txSignature, txError: txInfo.meta.err },
      "Claim transaction failed on-chain",
    );
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(txInfo.meta.err)}`);
  }

  await withdrawalRepo.updateStatus(withdrawalId, "CLAIMED", {
    claimTxSignature: txSignature,
    claimedAt: new Date(),
  });

  logger.info({ withdrawalId, txSignature }, "Withdrawal claimed successfully");
}
