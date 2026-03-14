import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  DISC_FULFILL_DEPOSIT,
  TOKEN_2022_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8, writeU64LE } from "../utils.js";

export interface FulfillDepositParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly pendingDeposit: PublicKey;
  readonly shareMint: PublicKey;
  readonly depositorShareAta: PublicKey;
  readonly depositor: PublicKey;
  readonly newSharePrice: bigint;
  readonly feeReceiverAta?: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a FulfillDeposit instruction (0x09).
 *
 * Data: [disc(1), new_share_price(8)] = 9 bytes
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [writable] vault_state
 *   2. [writable] pending_deposit — PDA to read and close
 *   3. [writable] share_mint
 *   4. [writable] depositor_share_ata
 *   5. [writable] depositor — receives rent refund (NOT a signer)
 *   6. []         token_program — Token 2022
 *   7. [writable] fee_receiver_ata — (optional)
 */
export function createFulfillDepositInstruction(
  params: FulfillDepositParams,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  const offset = writeU8(data, 0, DISC_FULFILL_DEPOSIT);
  writeU64LE(data, offset, params.newSharePrice);

  const keys: AccountMeta[] = [
    { pubkey: params.admin, isSigner: true, isWritable: false },
    { pubkey: params.vaultState, isSigner: false, isWritable: true },
    { pubkey: params.pendingDeposit, isSigner: false, isWritable: true },
    { pubkey: params.shareMint, isSigner: false, isWritable: true },
    { pubkey: params.depositorShareAta, isSigner: false, isWritable: true },
    { pubkey: params.depositor, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  if (params.feeReceiverAta) {
    keys.push({
      pubkey: params.feeReceiverAta,
      isSigner: false,
      isWritable: true,
    });
  }

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
