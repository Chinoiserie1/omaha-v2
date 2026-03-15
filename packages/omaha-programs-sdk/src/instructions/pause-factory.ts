import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_PAUSE_FACTORY, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8 } from "../utils.js";

export interface PauseFactoryParams {
  readonly owner: PublicKey;
  readonly factoryState: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a PauseFactory instruction (0x12).
 *
 * Data: [disc(1)] = 1 byte
 *
 * Accounts:
 *   0. [signer]   owner — must be factory owner
 *   1. [writable] factory_state
 */
export function createPauseFactoryInstruction(
  params: PauseFactoryParams,
): TransactionInstruction {
  const data = Buffer.alloc(1);
  writeU8(data, 0, DISC_PAUSE_FACTORY);

  const keys: AccountMeta[] = [
    { pubkey: params.owner, isSigner: true, isWritable: false },
    { pubkey: params.factoryState, isSigner: false, isWritable: true },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
