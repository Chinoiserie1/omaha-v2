import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  CLOCK_SYSVAR_ID,
  DISC_COLLECT_FEES,
  TOKEN_2022_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8 } from "../utils.js";

export interface CollectFeesParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly shareMint: PublicKey;
  readonly feeReceiverAta: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create a CollectFees instruction (0x06).
 *
 * Data: [disc(1)] = 1 byte (timestamp read from Clock sysvar)
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [writable] vault_state
 *   2. [writable] share_mint
 *   3. [writable] fee_receiver_ata
 *   4. []         token_program — Token 2022
 *   5. []         clock_sysvar
 */
export function createCollectFeesInstruction(
  params: CollectFeesParams,
): TransactionInstruction {
  const data = Buffer.alloc(1);
  writeU8(data, 0, DISC_COLLECT_FEES);

  const keys: AccountMeta[] = [
    { pubkey: params.admin, isSigner: true, isWritable: false },
    { pubkey: params.vaultState, isSigner: false, isWritable: true },
    { pubkey: params.shareMint, isSigner: false, isWritable: true },
    { pubkey: params.feeReceiverAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: CLOCK_SYSVAR_ID, isSigner: false, isWritable: false },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
