import { PublicKey } from "@solana/web3.js";

import {
  MAX_OWNERS,
  VAULT_DISCRIMINATOR,
  VAULT_STATE_SIZE,
} from "../constants.js";

export interface VaultState {
  readonly discriminator: number;
  readonly bump: number;
  readonly shareDecimals: number;
  readonly numOwners: number;
  readonly entryFeeBps: number;
  readonly exitFeeBps: number;
  readonly managementFeeBps: number;
  readonly performanceFeeBps: number;
  readonly admin: PublicKey;
  readonly shareMint: PublicKey;
  readonly baseMint: PublicKey;
  readonly feeReceiver: PublicKey;
  readonly sharePrice: bigint;
  readonly highWaterMark: bigint;
  readonly lastFeeTimestamp: bigint;
  readonly owners: readonly PublicKey[];
}

/**
 * Deserialize a VaultState from raw account data (488 bytes).
 *
 * Layout:
 *   0:   discriminator (u8, 0xA1)
 *   1:   bump (u8)
 *   2:   share_decimals (u8)
 *   3:   num_owners (u8)
 *   4:   entry_fee_bps (u16 LE)
 *   6:   exit_fee_bps (u16 LE)
 *   8:   management_fee_bps (u16 LE)
 *   10:  performance_fee_bps (u16 LE)
 *   12:  _padding (4 bytes)
 *   16:  admin (32)
 *   48:  share_mint (32)
 *   80:  base_mint (32)
 *   112: fee_receiver (32)
 *   144: share_price (u64 LE)
 *   152: high_water_mark (u64 LE)
 *   160: last_fee_timestamp (i64 LE)
 *   168: owners (10 × 32 = 320)
 */
export function deserializeVaultState(data: Buffer): VaultState {
  if (data.length < VAULT_STATE_SIZE) {
    throw new Error(
      `VaultState data too short: expected ${VAULT_STATE_SIZE}, got ${data.length}`,
    );
  }

  const discriminator = data.readUInt8(0);
  if (discriminator !== VAULT_DISCRIMINATOR) {
    throw new Error(
      `Invalid VaultState discriminator: expected 0x${VAULT_DISCRIMINATOR.toString(16)}, got 0x${discriminator.toString(16)}`,
    );
  }

  const numOwners = data.readUInt8(3);
  const owners: PublicKey[] = [];
  for (let i = 0; i < Math.min(numOwners, MAX_OWNERS); i++) {
    const offset = 168 + i * 32;
    owners.push(new PublicKey(data.subarray(offset, offset + 32)));
  }

  return {
    discriminator,
    bump: data.readUInt8(1),
    shareDecimals: data.readUInt8(2),
    numOwners,
    entryFeeBps: data.readUInt16LE(4),
    exitFeeBps: data.readUInt16LE(6),
    managementFeeBps: data.readUInt16LE(8),
    performanceFeeBps: data.readUInt16LE(10),
    admin: new PublicKey(data.subarray(16, 48)),
    shareMint: new PublicKey(data.subarray(48, 80)),
    baseMint: new PublicKey(data.subarray(80, 112)),
    feeReceiver: new PublicKey(data.subarray(112, 144)),
    sharePrice: data.readBigUInt64LE(144),
    highWaterMark: data.readBigUInt64LE(152),
    lastFeeTimestamp: data.readBigInt64LE(160),
    owners,
  };
}
