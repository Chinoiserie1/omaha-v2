import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  DISC_WITHDRAW_WITH_PRICE,
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8, writeU64LE } from "../utils.js";

export interface WithdrawWithPriceParams {
  readonly admin: PublicKey;
  readonly withdrawer: PublicKey;
  readonly withdrawerShareAta: PublicKey;
  readonly shareMint: PublicKey;
  readonly vaultBaseAta: PublicKey;
  readonly withdrawerBaseAta: PublicKey;
  readonly vaultState: PublicKey;
  readonly newSharePrice: bigint;
  readonly sharesToBurn: bigint;
  readonly programId?: PublicKey;
}

/**
 * Create a WithdrawWithPrice instruction (0x0A).
 *
 * Data: [disc(1), new_share_price(8), shares_to_burn(8)] = 17 bytes
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [signer]   withdrawer
 *   2. [writable] withdrawer_share_ata
 *   3. [writable] share_mint
 *   4. [writable] vault_base_ata
 *   5. [writable] withdrawer_base_ata
 *   6. [writable] vault_state
 *   7. []         token_program       — legacy SPL Token
 *   8. []         share_token_program — Token 2022
 */
export function createWithdrawWithPriceInstruction(
  params: WithdrawWithPriceParams,
): TransactionInstruction {
  const data = Buffer.alloc(17);
  let offset = writeU8(data, 0, DISC_WITHDRAW_WITH_PRICE);
  offset = writeU64LE(data, offset, params.newSharePrice);
  writeU64LE(data, offset, params.sharesToBurn);

  const keys: AccountMeta[] = [
    { pubkey: params.admin, isSigner: true, isWritable: false },
    { pubkey: params.withdrawer, isSigner: true, isWritable: false },
    { pubkey: params.withdrawerShareAta, isSigner: false, isWritable: true },
    { pubkey: params.shareMint, isSigner: false, isWritable: true },
    { pubkey: params.vaultBaseAta, isSigner: false, isWritable: true },
    { pubkey: params.withdrawerBaseAta, isSigner: false, isWritable: true },
    { pubkey: params.vaultState, isSigner: false, isWritable: true },
    { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
