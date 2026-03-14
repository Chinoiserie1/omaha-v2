import type { FastifyReply, FastifyRequest } from "fastify";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  createRequestWithdrawInstruction,
  findPendingWithdrawPda,
  findShareMintPda,
} from "@repo/omaha-programs-sdk";
import { getConnection, SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import { logger } from "../../../utils/logger.js";

type RedeemRequest = FastifyRequest<{
  Params: { id: string };
  Body: { amount: number; signerPublicKey: string };
}>;

/** @deprecated Use POST /api/withdrawals/:vaultId/request instead */
export async function redeemFromVault(
  request: RedeemRequest,
  reply: FastifyReply,
) {
  logger.warn("DEPRECATED: POST /api/vaults/:id/redeem — use /api/withdrawals/:vaultId/request");
  const { id } = request.params;
  const { amount, signerPublicKey } = request.body;

  if (typeof amount !== "number" || amount <= 0 || !isFinite(amount)) {
    return reply.status(400).send({ error: "Amount must be a positive number" });
  }

  let signerPubkey: PublicKey;
  try {
    signerPubkey = new PublicKey(signerPublicKey);
  } catch {
    return reply.status(400).send({ error: "Invalid signer public key" });
  }

  const vault = await vaultRepo.findVaultById(id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }
  if (!vault.statePda) {
    return reply.status(400).send({ error: "Vault has no state PDA" });
  }

  const statePda = new PublicKey(vault.statePda);
  const shares = BigInt(Math.round(amount * SHARE_TOKEN_MULTIPLIER));

  try {
    // Derive share mint from vault or PDA
    const shareMint = vault.shareMint
      ? new PublicKey(vault.shareMint)
      : findShareMintPda(statePda)[0];

    const withdrawerShareAta = await getAssociatedTokenAddress(
      shareMint,
      signerPubkey,
      false,
      new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"), // Token 2022
    );
    const [pendingWithdraw] = findPendingWithdrawPda(statePda, signerPubkey);

    const redeemIx = createRequestWithdrawInstruction({
      withdrawer: signerPubkey,
      withdrawerShareAta,
      shareMint,
      vaultState: statePda,
      pendingWithdraw,
      shares,
    });

    const connection = getConnection();
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction();
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      redeemIx,
    );
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signerPubkey;

    const serialized = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    logger.info(
      { vaultId: id, signer: signerPublicKey, amount },
      "Redeem transaction built",
    );

    return { transaction: serialized };
  } catch (err) {
    logger.error({ err, vaultId: id }, "Failed to build redeem transaction");
    return reply.status(500).send({
      error: "Failed to build redeem transaction",
    });
  }
}
