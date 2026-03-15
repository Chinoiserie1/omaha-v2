import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_ACCEPT_VAULT_ADMIN, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8 } from "../utils.js";

export interface AcceptVaultAdminParams {
  readonly newAdmin: PublicKey;
  readonly vaultState: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create an AcceptVaultAdmin instruction (0x15).
 *
 * Data: [disc(1)]
 *
 * Accounts:
 *   0. [signer]   new_admin (must match vault pending_admin)
 *   1. [writable] vault_state
 */
export function createAcceptVaultAdminInstruction(
  params: AcceptVaultAdminParams,
): TransactionInstruction {
  const data = Buffer.alloc(1);
  writeU8(data, 0, DISC_ACCEPT_VAULT_ADMIN);

  const keys: AccountMeta[] = [
    { pubkey: params.newAdmin, isSigner: true, isWritable: false },
    { pubkey: params.vaultState, isSigner: false, isWritable: true },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
