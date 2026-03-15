import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  DISC_INITIALIZE_FACTORY,
  PROGRAM_AUTHORITY,
  SYSTEM_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8 } from "../utils.js";

export interface InitializeFactoryParams {
  readonly programAuthority?: PublicKey;
  readonly owner: PublicKey;
  readonly factoryState: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create an InitializeFactory instruction (0x0D).
 *
 * Data: [disc(1)] = 1 byte
 *
 * Accounts:
 *   0. [signer]           program_authority — must match PROGRAM_AUTHORITY constant
 *   1. [signer, writable] owner — pays rent, becomes factory owner
 *   2. [writable]         factory_state — PDA ["factory"]
 *   3. []                 system_program
 */
export function createInitializeFactoryInstruction(
  params: InitializeFactoryParams,
): TransactionInstruction {
  const data = Buffer.alloc(1);
  writeU8(data, 0, DISC_INITIALIZE_FACTORY);

  const keys: AccountMeta[] = [
    { pubkey: params.programAuthority ?? PROGRAM_AUTHORITY, isSigner: true, isWritable: false },
    { pubkey: params.owner, isSigner: true, isWritable: true },
    { pubkey: params.factoryState, isSigner: false, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
