import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  CLOCK_SYSVAR_ID,
  DISC_CANCEL_WITHDRAW,
  TOKEN_2022_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8 } from "../utils.js";

export interface CancelWithdrawParams {
  readonly withdrawer: PublicKey;
  readonly pendingWithdraw: PublicKey;
  readonly vaultState: PublicKey;
  readonly shareMint: PublicKey;
  readonly withdrawerShareAta: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a CancelWithdraw instruction (0x19).
 *
 * Data: [disc(1)] = 1 byte
 *
 * Accounts:
 *   0. [signer, writable] withdrawer — must match pending.withdrawer; gets refunded rent
 *   1. [writable]         pending_withdraw — PDA being closed
 *   2. []                 vault_state — read-only (for PDA signer seeds + share_mint verification)
 *   3. [writable]         share_mint — Token 2022 mint for re-minting shares
 *   4. [writable]         withdrawer_share_ata — destination for re-minted shares
 *   5. []                 token_program — Token 2022
 *   6. []                 clock_sysvar
 */
export function createCancelWithdrawInstruction(
  params: CancelWithdrawParams,
): TransactionInstruction {
  const data = Buffer.alloc(1);
  writeU8(data, 0, DISC_CANCEL_WITHDRAW);

  const keys: AccountMeta[] = [
    { pubkey: params.withdrawer, isSigner: true, isWritable: true },
    { pubkey: params.pendingWithdraw, isSigner: false, isWritable: true },
    { pubkey: params.vaultState, isSigner: false, isWritable: false },
    { pubkey: params.shareMint, isSigner: false, isWritable: true },
    { pubkey: params.withdrawerShareAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: CLOCK_SYSVAR_ID, isSigner: false, isWritable: false },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
