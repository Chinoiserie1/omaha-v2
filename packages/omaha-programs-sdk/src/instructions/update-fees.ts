import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_UPDATE_FEES, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8, writeU16LE, writePubkey } from "../utils.js";

export interface UpdateFeesParams {
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly entryFeeBps: number;
  readonly exitFeeBps: number;
  readonly managementFeeBps: number;
  readonly performanceFeeBps: number;
  readonly feeReceiver: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create an UpdateFees instruction (0x05).
 *
 * Data: [disc(1), entry(2), exit(2), mgmt(2), perf(2), fee_receiver(32)] = 41 bytes
 *
 * Accounts:
 *   0. [signer]   admin
 *   1. [writable] vault_state
 */
export function createUpdateFeesInstruction(
  params: UpdateFeesParams,
): TransactionInstruction {
  const data = Buffer.alloc(41);
  let offset = writeU8(data, 0, DISC_UPDATE_FEES);
  offset = writeU16LE(data, offset, params.entryFeeBps);
  offset = writeU16LE(data, offset, params.exitFeeBps);
  offset = writeU16LE(data, offset, params.managementFeeBps);
  offset = writeU16LE(data, offset, params.performanceFeeBps);
  writePubkey(data, offset, params.feeReceiver);

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
