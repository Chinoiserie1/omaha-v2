import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_ACCEPT_FACTORY_OWNERSHIP, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8 } from "../utils.js";

export interface AcceptFactoryOwnershipParams {
  readonly newOwner: PublicKey;
  readonly factoryState: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create an AcceptFactoryOwnership instruction (0x11).
 *
 * Data: [disc(1)]
 *
 * Accounts:
 *   0. [signer]   new_owner (must match factory pending_owner)
 *   1. [writable] factory_state
 */
export function createAcceptFactoryOwnershipInstruction(
  params: AcceptFactoryOwnershipParams,
): TransactionInstruction {
  const data = Buffer.alloc(1);
  writeU8(data, 0, DISC_ACCEPT_FACTORY_OWNERSHIP);

  const keys: AccountMeta[] = [
    { pubkey: params.newOwner, isSigner: true, isWritable: false },
    { pubkey: params.factoryState, isSigner: false, isWritable: true },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
