import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_TRANSFER_FACTORY_OWNERSHIP, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8, writePubkey } from "../utils.js";

export interface TransferFactoryOwnershipParams {
  readonly owner: PublicKey;
  readonly factoryState: PublicKey;
  readonly newOwner: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a TransferFactoryOwnership instruction (0x10).
 *
 * Data: [disc(1), new_owner(32)]
 *
 * Accounts:
 *   0. [signer]   owner (current factory owner)
 *   1. [writable] factory_state
 */
export function createTransferFactoryOwnershipInstruction(
  params: TransferFactoryOwnershipParams,
): TransactionInstruction {
  const data = Buffer.alloc(33);
  const offset = writeU8(data, 0, DISC_TRANSFER_FACTORY_OWNERSHIP);
  writePubkey(data, offset, params.newOwner);

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
