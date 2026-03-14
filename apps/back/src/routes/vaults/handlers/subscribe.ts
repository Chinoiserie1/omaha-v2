import type { FastifyReply, FastifyRequest } from "fastify";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  createRequestDepositInstruction,
  findPendingDepositPda,
} from "@repo/omaha-programs-sdk";
import { getConnection, USDC_MINT } from "../../../solana/config.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import { logger } from "../../../utils/logger.js";

type SubscribeRequest = FastifyRequest<{
  Params: { id: string };
  Body: { amount: number; signerPublicKey: string };
}>;

export async function subscribeToVault(
  request: SubscribeRequest,
  reply: FastifyReply,
) {
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

  // Convert human-readable USDC amount to raw u64 (6 decimals)
  const amountRaw = BigInt(Math.round(amount * 1_000_000));

  try {
    // Derive accounts
    const depositorBaseAta = await getAssociatedTokenAddress(USDC_MINT, signerPubkey);
    const vaultBaseAta = vault.baseTokenAta
      ? new PublicKey(vault.baseTokenAta)
      : await getAssociatedTokenAddress(USDC_MINT, statePda, true);
    const [pendingDeposit] = findPendingDepositPda(statePda, signerPubkey);

    const depositIx = createRequestDepositInstruction({
      depositor: signerPubkey,
      depositorBaseAta,
      vaultBaseAta,
      vaultState: statePda,
      pendingDeposit,
      amount: amountRaw,
    });

    const connection = getConnection();
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction();
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      depositIx,
    );
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signerPubkey;

    // No keeper partial sign — user is sole signer
    const serialized = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    logger.info(
      { vaultId: id, signer: signerPublicKey, amount },
      "Subscribe transaction built",
    );

    return { transaction: serialized };
  } catch (err) {
    logger.error({ err, vaultId: id }, "Failed to build subscribe transaction");
    return reply.status(500).send({
      error: "Failed to build subscribe transaction",
    });
  }
}
