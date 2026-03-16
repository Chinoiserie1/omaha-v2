import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  CLOCK_SYSVAR_ID,
  DISC_REQUEST_WITHDRAW,
  SYSTEM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8, writeU64LE } from "../utils.js";

export interface RequestWithdrawParams {
  readonly withdrawer: PublicKey;
  readonly withdrawerShareAta: PublicKey;
  readonly shareMint: PublicKey;
  readonly vaultState: PublicKey;
  readonly pendingWithdraw: PublicKey;
  readonly vaultShareAta: PublicKey;
  readonly shares: bigint;
  readonly programId?: PublicKey;
}

/**
 * Create a RequestWithdraw instruction (0x0B).
 *
 * Data: [disc(1), shares(8)] = 9 bytes
 *
 * Accounts:
 *   0. [signer, writable] withdrawer
 *   1. [writable]         withdrawer_share_ata
 *   2. []                 share_mint           — read-only (validation only)
 *   3. []                 vault_state
 *   4. [writable]         pending_withdraw — PDA to create
 *   5. []                 system_program
 *   6. []                 token_program    — Token 2022
 *   7. []                 clock_sysvar
 *   8. [writable]         vault_share_ata  — escrow for share tokens
 */
export function createRequestWithdrawInstruction(
  params: RequestWithdrawParams,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  const offset = writeU8(data, 0, DISC_REQUEST_WITHDRAW);
  writeU64LE(data, offset, params.shares);

  const keys: AccountMeta[] = [
    { pubkey: params.withdrawer, isSigner: true, isWritable: true },
    { pubkey: params.withdrawerShareAta, isSigner: false, isWritable: true },
    { pubkey: params.shareMint, isSigner: false, isWritable: false },
    { pubkey: params.vaultState, isSigner: false, isWritable: false },
    { pubkey: params.pendingWithdraw, isSigner: false, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: CLOCK_SYSVAR_ID, isSigner: false, isWritable: false },
    { pubkey: params.vaultShareAta, isSigner: false, isWritable: true },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
