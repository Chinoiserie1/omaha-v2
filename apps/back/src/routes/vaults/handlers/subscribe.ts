import type { FastifyReply, FastifyRequest } from "fastify";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createDepositWithPriceInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@repo/omaha-programs-sdk";
import { getConnection, getKeeper, USDC_MINT } from "../../../solana/config.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import { computeOnChainSharePrice } from "../../../services/share-price-onchain.service.js";
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
  const amountRaw = BigInt(Math.round(amount * 1_000_000));

  try {
    const connection = getConnection();
    const keeper = getKeeper();

    // Compute share price (also returns vault state to avoid extra RPC call)
    const { sharePrice, vaultState } =
      await computeOnChainSharePrice(statePda);

    // Derive accounts
    const depositorBaseAta = getAssociatedTokenAddressSync(
      USDC_MINT,
      signerPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const vaultBaseAta = vault.baseTokenAta
      ? new PublicKey(vault.baseTokenAta)
      : getAssociatedTokenAddressSync(
          USDC_MINT,
          statePda,
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );

    const shareMint = vaultState.shareMint;

    const depositorShareAta = getAssociatedTokenAddressSync(
      shareMint,
      signerPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    // Check which ATAs need to be created
    const [vaultBaseAtaInfo, depositorShareAtaInfo] = await Promise.all([
      connection.getAccountInfo(vaultBaseAta),
      connection.getAccountInfo(depositorShareAta),
    ]);

    // Build transaction
    const transaction = new Transaction();

    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
    );

    if (!vaultBaseAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          signerPubkey,
          vaultBaseAta,
          statePda,
          USDC_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    if (!depositorShareAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          signerPubkey,
          depositorShareAta,
          signerPubkey,
          shareMint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Build DepositWithPrice instruction
    const depositParams = {
      admin: keeper.publicKey,
      depositor: signerPubkey,
      depositorBaseAta,
      vaultBaseAta,
      vaultState: statePda,
      shareMint,
      depositorShareAta,
      newSharePrice: sharePrice,
      depositAmount: amountRaw,
      ...(vaultState.entryFeeBps > 0 && {
        feeReceiverAta: getAssociatedTokenAddressSync(
          shareMint,
          vaultState.feeReceiver,
          false,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      }),
    };

    const depositIx = createDepositWithPriceInstruction(depositParams);

    transaction.add(depositIx);

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signerPubkey;

    // Keeper partial-signs as vault admin
    transaction.partialSign(keeper);

    const serialized = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    logger.info(
      {
        vaultId: id,
        signer: signerPublicKey,
        amount,
        sharePrice: sharePrice.toString(),
      },
      "DepositWithPrice transaction built (keeper partial-signed)",
    );

    return { transaction: serialized };
  } catch (err) {
    logger.error({ err, vaultId: id }, "Failed to build deposit transaction");
    return reply.status(500).send({
      error: "Failed to build deposit transaction",
    });
  }
}
