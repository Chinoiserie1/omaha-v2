import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_ADD_OPERATOR, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8, writePubkey } from "../utils.js";

export interface AddOperatorParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly newOperator: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create an AddOperator instruction (0x01).
 *
 * Data: [disc(1), new_operator(32)]
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [writable] vault_state
 */
export function createAddOperatorInstruction(
  params: AddOperatorParams,
): TransactionInstruction {
  const data = Buffer.alloc(33);
  const offset = writeU8(data, 0, DISC_ADD_OPERATOR);
  writePubkey(data, offset, params.newOperator);

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
