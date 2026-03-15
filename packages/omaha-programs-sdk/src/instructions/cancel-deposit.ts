import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  CLOCK_SYSVAR_ID,
  DISC_CANCEL_DEPOSIT,
  SPL_TOKEN_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8 } from "../utils.js";

export interface CancelDepositParams {
  readonly depositor: PublicKey;
  readonly pendingDeposit: PublicKey;
  readonly vaultState: PublicKey;
  readonly vaultBaseAta: PublicKey;
  readonly depositorBaseAta: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a CancelDeposit instruction (0x18).
 *
 * Data: [disc(1)] = 1 byte
 *
 * Accounts:
 *   0. [signer, writable] depositor — must match pending.depositor; gets refunded rent
 *   1. [writable]         pending_deposit — PDA being closed
 *   2. []                 vault_state — read-only (for PDA signer seeds)
 *   3. [writable]         vault_base_ata — source of refunded tokens
 *   4. [writable]         depositor_base_ata — destination for refunded tokens
 *   5. []                 token_program — legacy SPL Token
 *   6. []                 clock_sysvar
 */
export function createCancelDepositInstruction(
  params: CancelDepositParams,
): TransactionInstruction {
  const data = Buffer.alloc(1);
  writeU8(data, 0, DISC_CANCEL_DEPOSIT);

  const keys: AccountMeta[] = [
    { pubkey: params.depositor, isSigner: true, isWritable: true },
    { pubkey: params.pendingDeposit, isSigner: false, isWritable: true },
    { pubkey: params.vaultState, isSigner: false, isWritable: false },
    { pubkey: params.vaultBaseAta, isSigner: false, isWritable: true },
    { pubkey: params.depositorBaseAta, isSigner: false, isWritable: true },
    { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: CLOCK_SYSVAR_ID, isSigner: false, isWritable: false },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
