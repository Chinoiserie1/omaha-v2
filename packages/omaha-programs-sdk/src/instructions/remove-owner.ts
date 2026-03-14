import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_REMOVE_OWNER, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8, writePubkey } from "../utils.js";

export interface RemoveOwnerParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly ownerToRemove: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a RemoveOwner instruction (0x02).
 *
 * Data: [disc(1), owner_to_remove(32)]
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [writable] vault_state
 */
export function createRemoveOwnerInstruction(
  params: RemoveOwnerParams,
): TransactionInstruction {
  const data = Buffer.alloc(33);
  const offset = writeU8(data, 0, DISC_REMOVE_OWNER);
  writePubkey(data, offset, params.ownerToRemove);

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
