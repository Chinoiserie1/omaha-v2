import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getConnection, getFeePayer, USDC_MINT, USDC_DECIMALS } from "../solana/config.js";
import { logger } from "../utils/logger.js";
import type { FundSolPlan } from "./fund-sol.service.js";

export async function buildFundSolTransaction(
  signerPublicKey: string,
  plan: FundSolPlan,
): Promise<string> {
  const signer = new PublicKey(signerPublicKey);
  const feePayer = getFeePayer();
  const connection = getConnection();

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction();

  // 1. Compute budget
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
  );

  // 2. Platform fee transfer: user USDC ATA → fee payer USDC ATA
  const platformFeeAmount = Math.round(
    plan.quote.platformFeeUsdc * 10 ** USDC_DECIMALS,
  );

  if (platformFeeAmount > 0) {
    const signerUsdcAta = getAssociatedTokenAddressSync(
      USDC_MINT,
      signer,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const feePayerUsdcAta = getAssociatedTokenAddressSync(
      USDC_MINT,
      feePayer.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    // Create fee payer's USDC ATA if it doesn't exist
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        signer, // payer for ATA creation
        feePayerUsdcAta,
        feePayer.publicKey,
        USDC_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );

    // Transfer platform fee
    transaction.add(
      createTransferCheckedInstruction(
        signerUsdcAta,
        USDC_MINT,
        feePayerUsdcAta,
        signer, // authority
        platformFeeAmount,
        USDC_DECIMALS,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  // 3. Jupiter setup instructions
  for (const ix of plan.setupInstructions) {
    transaction.add(ix);
  }

  // 4. Jupiter swap instruction
  transaction.add(plan.swapInstruction);

  // 5. Jupiter cleanup instruction
  if (plan.cleanupInstruction) {
    transaction.add(plan.cleanupInstruction);
  }

  // 6. Set fee payer (platform pays Solana tx fee) and blockhash
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = feePayer.publicKey;

  // 7. Partial sign with fee payer
  transaction.partialSign(feePayer);

  // 8. Serialize (user still needs to sign)
  const serialized = transaction
    .serialize({ requireAllSignatures: false })
    .toString("base64");

  logger.info(
    { signer: signerPublicKey, feePayer: feePayer.publicKey.toBase58() },
    "Fund SOL transaction built",
  );

  return serialized;
}
