import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_SET_SHARE_PRICE, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8, writeU64LE } from "../utils.js";

export interface SetSharePriceParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly newSharePrice: bigint;
  readonly programId?: PublicKey;
}

/**
 * Create a SetSharePrice instruction (0x03).
 *
 * Data: [disc(1), new_share_price(8)]
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [writable] vault_state
 */
export function createSetSharePriceInstruction(
  params: SetSharePriceParams,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  const offset = writeU8(data, 0, DISC_SET_SHARE_PRICE);
  writeU64LE(data, offset, params.newSharePrice);

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
