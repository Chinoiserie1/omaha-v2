import { PublicKey } from "@solana/web3.js";

import {
  PENDING_WITHDRAW_DISCRIMINATOR,
  PENDING_WITHDRAW_SIZE,
} from "../constants.js";

export interface PendingWithdraw {
  readonly discriminator: number;
  readonly bump: number;
  readonly exitFeeBps: number;
  readonly vaultState: PublicKey;
  readonly withdrawer: PublicKey;
  readonly shares: bigint;
  readonly createdAt: bigint;
}

/**
 * Deserialize a PendingWithdraw from raw account data (88 bytes).
 *
 * Layout:
 *   0:  discriminator (u8, 0xA3)
 *   1:  bump (u8)
 *   2:  exit_fee_bps (u16 LE)
 *   4:  _padding (4 bytes)
 *   8:  vault_state (32)
 *   40: withdrawer (32)
 *   72: shares (u64 LE)
 *   80: created_at (i64 LE)
 */
export function deserializePendingWithdraw(data: Buffer): PendingWithdraw {
  if (data.length < PENDING_WITHDRAW_SIZE) {
    throw new Error(
      `PendingWithdraw data too short: expected ${PENDING_WITHDRAW_SIZE}, got ${data.length}`,
    );
  }

  const discriminator = data.readUInt8(0);
  if (discriminator !== PENDING_WITHDRAW_DISCRIMINATOR) {
    throw new Error(
      `Invalid PendingWithdraw discriminator: expected 0x${PENDING_WITHDRAW_DISCRIMINATOR.toString(16)}, got 0x${discriminator.toString(16)}`,
    );
  }

  return {
    discriminator,
    bump: data.readUInt8(1),
    exitFeeBps: data.readUInt16LE(2),
    vaultState: new PublicKey(data.subarray(8, 40)),
    withdrawer: new PublicKey(data.subarray(40, 72)),
    shares: data.readBigUInt64LE(72),
    createdAt: data.readBigInt64LE(80),
  };
}
