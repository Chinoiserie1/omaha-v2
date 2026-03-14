import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  DISC_DEPOSIT_WITH_PRICE,
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8, writeU64LE } from "../utils.js";

export interface DepositWithPriceParams {
  readonly admin: PublicKey;
  readonly depositor: PublicKey;
  readonly depositorBaseAta: PublicKey;
  readonly vaultBaseAta: PublicKey;
  readonly vaultState: PublicKey;
  readonly shareMint: PublicKey;
  readonly depositorShareAta: PublicKey;
  readonly newSharePrice: bigint;
  readonly depositAmount: bigint;
  readonly feeReceiverAta?: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a DepositWithPrice instruction (0x07).
 *
 * Data: [disc(1), new_share_price(8), deposit_amount(8)] = 17 bytes
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [signer]   depositor
 *   2. [writable] depositor_base_ata
 *   3. [writable] vault_base_ata
 *   4. [writable] vault_state
 *   5. [writable] share_mint
 *   6. [writable] depositor_share_ata
 *   7. []         token_program       — legacy SPL Token
 *   8. []         share_token_program — Token 2022
 *   9. [writable] fee_receiver_ata    — (optional)
 */
export function createDepositWithPriceInstruction(
  params: DepositWithPriceParams,
): TransactionInstruction {
  const data = Buffer.alloc(17);
  let offset = writeU8(data, 0, DISC_DEPOSIT_WITH_PRICE);
  offset = writeU64LE(data, offset, params.newSharePrice);
  writeU64LE(data, offset, params.depositAmount);

  const keys: AccountMeta[] = [
    { pubkey: params.admin, isSigner: true, isWritable: false },
    { pubkey: params.depositor, isSigner: true, isWritable: false },
    { pubkey: params.depositorBaseAta, isSigner: false, isWritable: true },
    { pubkey: params.vaultBaseAta, isSigner: false, isWritable: true },
    { pubkey: params.vaultState, isSigner: false, isWritable: true },
    { pubkey: params.shareMint, isSigner: false, isWritable: true },
    { pubkey: params.depositorShareAta, isSigner: false, isWritable: true },
    { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
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
