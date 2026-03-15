import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_REMOVE_OPERATOR, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8, writePubkey } from "../utils.js";

export interface RemoveOperatorParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly operatorToRemove: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a RemoveOperator instruction (0x02).
 *
 * Data: [disc(1), operator_to_remove(32)]
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [writable] vault_state
 */
export function createRemoveOperatorInstruction(
  params: RemoveOperatorParams,
): TransactionInstruction {
  const data = Buffer.alloc(33);
  const offset = writeU8(data, 0, DISC_REMOVE_OPERATOR);
  writePubkey(data, offset, params.operatorToRemove);

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
