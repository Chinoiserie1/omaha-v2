import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  DISC_REQUEST_DEPOSIT,
  SPL_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8, writeU64LE } from "../utils.js";

export interface RequestDepositParams {
  readonly depositor: PublicKey;
  readonly depositorBaseAta: PublicKey;
  readonly vaultBaseAta: PublicKey;
  readonly vaultState: PublicKey;
  readonly pendingDeposit: PublicKey;
  readonly amount: bigint;
  readonly programId?: PublicKey;
}

/**
 * Create a RequestDeposit instruction (0x08).
 *
 * Data: [disc(1), amount(8)] = 9 bytes
 *
 * Accounts:
 *   0. [signer, writable] depositor
 *   1. [writable]         depositor_base_ata
 *   2. [writable]         vault_base_ata
 *   3. []                 vault_state
 *   4. [writable]         pending_deposit — PDA to create
 *   5. []                 system_program
 *   6. []                 token_program   — legacy SPL Token
 */
export function createRequestDepositInstruction(
  params: RequestDepositParams,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  const offset = writeU8(data, 0, DISC_REQUEST_DEPOSIT);
  writeU64LE(data, offset, params.amount);

  const keys: AccountMeta[] = [
    { pubkey: params.depositor, isSigner: true, isWritable: true },
    { pubkey: params.depositorBaseAta, isSigner: false, isWritable: true },
    { pubkey: params.vaultBaseAta, isSigner: false, isWritable: true },
    { pubkey: params.vaultState, isSigner: false, isWritable: false },
    { pubkey: params.pendingDeposit, isSigner: false, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
