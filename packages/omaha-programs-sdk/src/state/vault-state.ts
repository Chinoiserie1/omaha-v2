import { PublicKey } from "@solana/web3.js";

import {
  MAX_OPERATORS,
  VAULT_DISCRIMINATOR,
  VAULT_STATE_SIZE,
} from "../constants.js";

export interface VaultState {
  readonly discriminator: number;
  readonly bump: number;
  readonly shareDecimals: number;
  readonly numOperators: number;
  readonly entryFeeBps: number;
  readonly exitFeeBps: number;
  readonly managementFeeBps: number;
  readonly performanceFeeBps: number;
  readonly vaultNameLen: number;
  readonly isPaused: boolean;
  readonly admin: PublicKey;
  readonly pendingAdmin: PublicKey;
  readonly shareMint: PublicKey;
  readonly baseMint: PublicKey;
  readonly feeReceiver: PublicKey;
  readonly factory: PublicKey;
  readonly sharePrice: bigint;
  readonly highWaterMark: bigint;
  readonly lastFeeTimestamp: bigint;
  readonly operators: readonly PublicKey[];
  readonly vaultName: string;
}

/**
 * Deserialize a VaultState from raw account data (584 bytes).
 *
 * Layout:
 *   0:   discriminator (u8, 0xA1)
 *   1:   bump (u8)
 *   2:   share_decimals (u8)
 *   3:   num_operators (u8)
 *   4:   entry_fee_bps (u16 LE)
 *   6:   exit_fee_bps (u16 LE)
 *   8:   management_fee_bps (u16 LE)
 *   10:  performance_fee_bps (u16 LE)
 *   12:  vault_name_len (u8)
 *   13:  is_paused (u8)
 *   14:  _padding (2 bytes)
 *   16:  admin (32)
 *   48:  pending_admin (32)
 *   80:  share_mint (32)
 *   112: base_mint (32)
 *   144: fee_receiver (32)
 *   176: factory (32)
 *   208: share_price (u64 LE)
 *   216: high_water_mark (u64 LE)
 *   224: last_fee_timestamp (i64 LE)
 *   232: operators (10 × 32 = 320)
 *   552: vault_name (vault_name_len bytes, max 32)
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

  const numOperators = data.readUInt8(3);
  const vaultNameLen = data.readUInt8(12);
  const operators: PublicKey[] = [];
  for (let i = 0; i < Math.min(numOperators, MAX_OPERATORS); i++) {
    const offset = 232 + i * 32;
    operators.push(new PublicKey(data.subarray(offset, offset + 32)));
  }
  const vaultName = data.subarray(552, 552 + vaultNameLen).toString("utf-8");

  return {
    discriminator,
    bump: data.readUInt8(1),
    shareDecimals: data.readUInt8(2),
    numOperators,
    entryFeeBps: data.readUInt16LE(4),
    exitFeeBps: data.readUInt16LE(6),
    managementFeeBps: data.readUInt16LE(8),
    performanceFeeBps: data.readUInt16LE(10),
    vaultNameLen,
    isPaused: data.readUInt8(13) !== 0,
    admin: new PublicKey(data.subarray(16, 48)),
    pendingAdmin: new PublicKey(data.subarray(48, 80)),
    shareMint: new PublicKey(data.subarray(80, 112)),
    baseMint: new PublicKey(data.subarray(112, 144)),
    feeReceiver: new PublicKey(data.subarray(144, 176)),
    factory: new PublicKey(data.subarray(176, 208)),
    sharePrice: data.readBigUInt64LE(208),
    highWaterMark: data.readBigUInt64LE(216),
    lastFeeTimestamp: data.readBigInt64LE(224),
    operators,
    vaultName,
  };
}
