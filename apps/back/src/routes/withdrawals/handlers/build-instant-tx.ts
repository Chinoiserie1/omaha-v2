import type { Connection } from "@solana/web3.js";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createWithdrawWithPriceInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@repo/omaha-programs-sdk";
import { getAdmin, USDC_MINT } from "../../../solana/config.js";
import type { BuiltTx } from "./build-queued-tx.js";

/**
 * Build a WithdrawWithPrice transaction (instant path).
 * Admin partial-signs; user signs on mobile.
 * Returns the base64-serialized transaction with blockhash info.
 */
export async function buildInstantWithdrawTx(params: {
  readonly statePda: PublicKey;
  readonly shareMint: PublicKey;
  readonly baseTokenAta: string | null;
  readonly shares: bigint;
  readonly sharePrice: bigint;
  readonly signerPubkey: PublicKey;
  readonly connection: Connection;
}): Promise<BuiltTx> {
  const { statePda, shareMint, baseTokenAta, shares, sharePrice, signerPubkey, connection } = params;
  const admin = getAdmin();

  const withdrawerShareAta = getAssociatedTokenAddressSync(
    shareMint, signerPubkey, false,
    TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const vaultBaseAta = baseTokenAta
    ? new PublicKey(baseTokenAta)
    : getAssociatedTokenAddressSync(
        USDC_MINT, statePda, true,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      );

  const withdrawerBaseAta = getAssociatedTokenAddressSync(
    USDC_MINT, signerPubkey, false,
    TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const withdrawIx = createWithdrawWithPriceInstruction({
    admin: admin.publicKey,
    withdrawer: signerPubkey,
    withdrawerShareAta,
    shareMint,
    vaultBaseAta,
    withdrawerBaseAta,
    vaultState: statePda,
    newSharePrice: sharePrice,
    sharesToBurn: shares,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const withdrawerBaseAtaInfo = await connection.getAccountInfo(withdrawerBaseAta);

  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
  );

  if (!withdrawerBaseAtaInfo) {
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        signerPubkey, withdrawerBaseAta, signerPubkey, USDC_MINT,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  transaction.add(withdrawIx);
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = signerPubkey;

  transaction.partialSign(admin);

  return {
    transaction: transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    blockhash,
    lastValidBlockHeight,
  };
}
