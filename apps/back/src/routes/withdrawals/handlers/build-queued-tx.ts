import { type Connection, type PublicKey, ComputeBudgetProgram, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  createRequestWithdrawInstruction,
  findPendingWithdrawPda,
  findVaultShareAta,
  TOKEN_2022_PROGRAM_ID,
} from "@repo/omaha-programs-sdk";

/**
 * Build a RequestWithdraw transaction (queued path).
 * User signs alone; shares are escrowed for batch fulfillment.
 * Returns the base64-serialized transaction.
 */
export interface BuiltTx {
  readonly transaction: string;
  readonly blockhash: string;
  readonly lastValidBlockHeight: number;
}

export async function buildQueuedWithdrawTx(params: {
  readonly statePda: PublicKey;
  readonly shareMint: PublicKey;
  readonly shares: bigint;
  readonly signerPubkey: PublicKey;
  readonly connection: Connection;
}): Promise<BuiltTx> {
  const { statePda, shareMint, shares, signerPubkey, connection } = params;

  const withdrawerShareAta = await getAssociatedTokenAddress(
    shareMint, signerPubkey, false, TOKEN_2022_PROGRAM_ID,
  );
  const [pendingWithdraw] = findPendingWithdrawPda(statePda, signerPubkey);
  const vaultShareAta = findVaultShareAta(shareMint, statePda);

  const redeemIx = createRequestWithdrawInstruction({
    withdrawer: signerPubkey,
    withdrawerShareAta,
    shareMint,
    vaultState: statePda,
    pendingWithdraw,
    vaultShareAta,
    shares,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const vaultShareAtaInfo = await connection.getAccountInfo(vaultShareAta);

  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
  );

  if (!vaultShareAtaInfo) {
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        signerPubkey, vaultShareAta, statePda, shareMint,
        TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  transaction.add(redeemIx);
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = signerPubkey;

  return {
    transaction: transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    blockhash,
    lastValidBlockHeight,
  };
}
