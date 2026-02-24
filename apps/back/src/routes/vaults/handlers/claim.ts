import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getGlamClient } from "../../../solana/client.js";
import { getConnection } from "../../../solana/config.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import { logger } from "../../../utils/logger.js";

type ClaimRequest = FastifyRequest<{
  Params: { id: string };
  Body: { signerPublicKey: string };
}>;

export async function claimRedemption(
  request: ClaimRequest,
  reply: FastifyReply,
) {
  const { id } = request.params;
  const { signerPublicKey } = request.body;

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
  const glamClient = getGlamClient(statePda);

  try {
    const claimIx = await glamClient.invest.txBuilder.claimIx(
      null,
      signerPubkey,
    );

    const connection = getConnection();
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction();
    transaction.add(claimIx);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signerPubkey;

    const serialized = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    logger.info(
      { vaultId: id, signer: signerPublicKey },
      "Claim transaction built",
    );

    return { transaction: serialized };
  } catch (err) {
    logger.error({ err, vaultId: id }, "Failed to build claim transaction");
    return reply.status(500).send({
      error: "Failed to build claim transaction",
    });
  }
}
