import { PublicKey } from "@solana/web3.js";

import {
  FACTORY_DISCRIMINATOR,
  FACTORY_STATE_SIZE,
  MAX_FACTORY_ADMINS,
} from "../constants.js";

export interface FactoryState {
  readonly discriminator: number;
  readonly bump: number;
  readonly isPaused: boolean;
  readonly numAdmins: number;
  readonly owner: PublicKey;
  readonly pendingOwner: PublicKey;
  readonly vaultCount: bigint;
  readonly admins: readonly PublicKey[];
}

/**
 * Deserialize a FactoryState from raw account data (400 bytes).
 *
 * Layout:
 *   0:   discriminator (u8, 0xA4)
 *   1:   bump (u8)
 *   2:   is_paused (u8)
 *   3:   num_admins (u8)
 *   4:   _padding (4 bytes)
 *   8:   owner (32)
 *   40:  pending_owner (32)
 *   72:  vault_count (u64 LE)
 *   80:  admins (10 × 32 = 320)
 */
export function deserializeFactoryState(data: Buffer): FactoryState {
  if (data.length < FACTORY_STATE_SIZE) {
    throw new Error(
      `FactoryState data too short: expected ${FACTORY_STATE_SIZE}, got ${data.length}`,
    );
  }

  const discriminator = data.readUInt8(0);
  if (discriminator !== FACTORY_DISCRIMINATOR) {
    throw new Error(
      `Invalid FactoryState discriminator: expected 0x${FACTORY_DISCRIMINATOR.toString(16)}, got 0x${discriminator.toString(16)}`,
    );
  }

  const numAdmins = data.readUInt8(3);
  const admins: PublicKey[] = [];
  for (let i = 0; i < Math.min(numAdmins, MAX_FACTORY_ADMINS); i++) {
    const offset = 80 + i * 32;
    admins.push(new PublicKey(data.subarray(offset, offset + 32)));
  }

  return {
    discriminator,
    bump: data.readUInt8(1),
    isPaused: data.readUInt8(2) !== 0,
    numAdmins,
    owner: new PublicKey(data.subarray(8, 40)),
    pendingOwner: new PublicKey(data.subarray(40, 72)),
    vaultCount: data.readBigUInt64LE(72),
    admins,
  };
}
