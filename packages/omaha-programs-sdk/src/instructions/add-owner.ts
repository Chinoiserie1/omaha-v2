import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_ADD_OWNER, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8, writePubkey } from "../utils.js";

export interface AddOwnerParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly newOwner: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create an AddOwner instruction (0x01).
 *
 * Data: [disc(1), new_owner(32)]
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [writable] vault_state
 */
export function createAddOwnerInstruction(
  params: AddOwnerParams,
): TransactionInstruction {
  const data = Buffer.alloc(33);
  const offset = writeU8(data, 0, DISC_ADD_OWNER);
  writePubkey(data, offset, params.newOwner);

  const keys: AccountMeta[] = [
    { pubkey: params.admin, isSigner: true, isWritable: false },
    { pubkey: params.vaultState, isSigner: false, isWritable: true },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
