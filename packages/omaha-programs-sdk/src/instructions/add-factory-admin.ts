import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_ADD_FACTORY_ADMIN, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8, writePubkey } from "../utils.js";

export interface AddFactoryAdminParams {
  readonly owner: PublicKey;
  readonly factoryState: PublicKey;
  readonly newAdmin: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create an AddFactoryAdmin instruction (0x0E).
 *
 * Data: [disc(1), new_admin(32)]
 *
 * Accounts:
 *   0. [signer]   owner (factory owner only)
 *   1. [writable] factory_state
 */
export function createAddFactoryAdminInstruction(
  params: AddFactoryAdminParams,
): TransactionInstruction {
  const data = Buffer.alloc(33);
  const offset = writeU8(data, 0, DISC_ADD_FACTORY_ADMIN);
  writePubkey(data, offset, params.newAdmin);

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
