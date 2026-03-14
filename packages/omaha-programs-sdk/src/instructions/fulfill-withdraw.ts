import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  DISC_FULFILL_WITHDRAW,
  SPL_TOKEN_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8, writeU64LE } from "../utils.js";

export interface FulfillWithdrawParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly pendingWithdraw: PublicKey;
  readonly vaultBaseAta: PublicKey;
  readonly withdrawerBaseAta: PublicKey;
  readonly withdrawer: PublicKey;
  readonly newSharePrice: bigint;
  readonly programId?: PublicKey;
}

/**
 * Create a FulfillWithdraw instruction (0x0C).
 *
 * Data: [disc(1), new_share_price(8)] = 9 bytes
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [writable] vault_state
 *   2. [writable] pending_withdraw — PDA to read and close
 *   3. [writable] vault_base_ata
 *   4. [writable] withdrawer_base_ata
 *   5. [writable] withdrawer — receives rent refund (NOT a signer)
 *   6. []         token_program — legacy SPL Token
 */
export function createFulfillWithdrawInstruction(
  params: FulfillWithdrawParams,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  const offset = writeU8(data, 0, DISC_FULFILL_WITHDRAW);
  writeU64LE(data, offset, params.newSharePrice);

  const keys: AccountMeta[] = [
    { pubkey: params.admin, isSigner: true, isWritable: false },
    { pubkey: params.vaultState, isSigner: false, isWritable: true },
    { pubkey: params.pendingWithdraw, isSigner: false, isWritable: true },
    { pubkey: params.vaultBaseAta, isSigner: false, isWritable: true },
    { pubkey: params.withdrawerBaseAta, isSigner: false, isWritable: true },
    { pubkey: params.withdrawer, isSigner: false, isWritable: true },
    { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
