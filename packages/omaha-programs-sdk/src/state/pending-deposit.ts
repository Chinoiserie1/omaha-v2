import { PublicKey } from "@solana/web3.js";

import {
  PENDING_DEPOSIT_DISCRIMINATOR,
  PENDING_DEPOSIT_SIZE,
} from "../constants.js";

export interface PendingDeposit {
  readonly discriminator: number;
  readonly bump: number;
  readonly entryFeeBps: number;
  readonly vaultState: PublicKey;
  readonly depositor: PublicKey;
  readonly amount: bigint;
  readonly createdAt: bigint;
}

/**
 * Deserialize a PendingDeposit from raw account data (88 bytes).
 *
 * Layout:
 *   0:  discriminator (u8, 0xA2)
 *   1:  bump (u8)
 *   2:  entry_fee_bps (u16 LE)
 *   4:  _padding (4 bytes)
 *   8:  vault_state (32)
 *   40: depositor (32)
 *   72: amount (u64 LE)
 *   80: created_at (i64 LE)
 */
export function deserializePendingDeposit(data: Buffer): PendingDeposit {
  if (data.length < PENDING_DEPOSIT_SIZE) {
    throw new Error(
      `PendingDeposit data too short: expected ${PENDING_DEPOSIT_SIZE}, got ${data.length}`,
    );
  }

  const discriminator = data.readUInt8(0);
  if (discriminator !== PENDING_DEPOSIT_DISCRIMINATOR) {
    throw new Error(
      `Invalid PendingDeposit discriminator: expected 0x${PENDING_DEPOSIT_DISCRIMINATOR.toString(16)}, got 0x${discriminator.toString(16)}`,
    );
  }

  return {
    discriminator,
    bump: data.readUInt8(1),
    entryFeeBps: data.readUInt16LE(2),
    vaultState: new PublicKey(data.subarray(8, 40)),
    depositor: new PublicKey(data.subarray(40, 72)),
    amount: data.readBigUInt64LE(72),
    createdAt: data.readBigInt64LE(80),
  };
}
