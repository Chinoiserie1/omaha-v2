import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_TRANSFER_VAULT_ADMIN, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8, writePubkey } from "../utils.js";

export interface TransferVaultAdminParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly newAdmin: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a TransferVaultAdmin instruction (0x14).
 *
 * Data: [disc(1), new_admin(32)]
 *
 * Accounts:
 *   0. [signer]   admin (current vault admin)
 *   1. [writable] vault_state
 */
export function createTransferVaultAdminInstruction(
  params: TransferVaultAdminParams,
): TransactionInstruction {
  const data = Buffer.alloc(33);
  const offset = writeU8(data, 0, DISC_TRANSFER_VAULT_ADMIN);
  writePubkey(data, offset, params.newAdmin);

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
