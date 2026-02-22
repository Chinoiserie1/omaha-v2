import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { mapToGlamIx } from "@glamsystems/ix-mapper";
import { getKeeper } from "./config.js";
import { logger } from "../utils/logger.js";

/**
 * Map a native instruction (e.g. Jupiter swap) to a GLAM vault instruction.
 * Parameterized by statePda so it works with multiple vaults.
 */
export function wrapForGlam(
  ix: TransactionInstruction,
  glamStatePda: PublicKey
): TransactionInstruction {
  const keeper = getKeeper();
  const mapped = mapToGlamIx(ix, glamStatePda, keeper.publicKey);

  if (!mapped) {
    throw new Error(
      `Unsupported ix for program ${ix.programId.toBase58()}`
    );
  }

  logger.debug(
    { program: ix.programId.toBase58() },
    "Instruction mapped to GLAM proxy"
  );
  return mapped;
}
