import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { getGlamClient } from "../../../solana/client.js";
import { getConnection, getKeeper } from "../../../solana/config.js";
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

  // Validate amount
  if (typeof amount !== "number" || amount <= 0 || !isFinite(amount)) {
    return reply.status(400).send({ error: "Amount must be a positive number" });
  }

  // Validate signer public key
  let signerPubkey: PublicKey;
  try {
    signerPubkey = new PublicKey(signerPublicKey);
  } catch {
    return reply.status(400).send({ error: "Invalid signer public key" });
  }

  // Find vault
  const vault = await vaultRepo.findVaultById(id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }

  if (!vault.statePda) {
    return reply.status(400).send({ error: "Vault has no state PDA" });
  }

  const statePda = new PublicKey(vault.statePda);
  const glamClient = getGlamClient(statePda);

  // Convert human-readable USDC amount to 6-decimal integer
  const amountBN = new BN(Math.round(amount * 1_000_000));

  try {
    // Price all vault tokens first (required by GLAM before subscribe)
    const priceIxs = await glamClient.price.priceVaultIxs();

    const subscribeIxs = await glamClient.invest.txBuilder.subscribeIxs(
      amountBN,
      signerPubkey,
    );

    const connection = getConnection();
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction();
    transaction.add(...priceIxs, ...subscribeIxs);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signerPubkey;

    // Partially sign with the keeper (required for pricing instructions)
    const keeper = getKeeper();
    transaction.partialSign(keeper);

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
