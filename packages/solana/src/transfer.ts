import {
  type Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function buildSolTransferTransaction(
  connection: Connection,
  from: string,
  to: string,
  amountSol: number,
): Promise<Transaction> {
  const fromPubkey = new PublicKey(from);
  const toPubkey = new PublicKey(to);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: Math.round(amountSol * LAMPORTS_PER_SOL),
    }),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  return transaction;
}

export async function buildTokenTransferTransaction(
  connection: Connection,
  from: string,
  to: string,
  mint: string,
  amountUi: number,
  decimals: number,
  programId: string,
): Promise<Transaction> {
  const fromPubkey = new PublicKey(from);
  const toPubkey = new PublicKey(to);
  const mintPubkey = new PublicKey(mint);
  const tokenProgramId = new PublicKey(programId);

  const sourceAta = getAssociatedTokenAddressSync(
    mintPubkey,
    fromPubkey,
    false,
    tokenProgramId,
  );

  const destinationAta = getAssociatedTokenAddressSync(
    mintPubkey,
    toPubkey,
    false,
    tokenProgramId,
  );

  const rawAmount = BigInt(Math.round(amountUi * 10 ** decimals));

  const transaction = new Transaction();

  // Create destination ATA if it doesn't exist (idempotent — safe if it already exists)
  transaction.add(
    createAssociatedTokenAccountIdempotentInstruction(
      fromPubkey,
      destinationAta,
      toPubkey,
      mintPubkey,
      tokenProgramId,
    ),
  );

  transaction.add(
    createTransferCheckedInstruction(
      sourceAta,
      mintPubkey,
      destinationAta,
      fromPubkey,
      rawAmount,
      decimals,
      [],
      tokenProgramId,
    ),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  return transaction;
}
