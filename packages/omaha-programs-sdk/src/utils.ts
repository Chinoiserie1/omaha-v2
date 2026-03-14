import type { PublicKey } from "@solana/web3.js";

/** Write a u8 into buffer at offset. Returns new offset. */
export function writeU8(buf: Buffer, offset: number, value: number): number {
  buf.writeUInt8(value, offset);
  return offset + 1;
}

/** Write a u16 LE into buffer at offset. Returns new offset. */
export function writeU16LE(
  buf: Buffer,
  offset: number,
  value: number,
): number {
  buf.writeUInt16LE(value, offset);
  return offset + 2;
}

/** Write a u64 LE (bigint) into buffer at offset. Returns new offset. */
export function writeU64LE(
  buf: Buffer,
  offset: number,
  value: bigint,
): number {
  buf.writeBigUInt64LE(value, offset);
  return offset + 8;
}

/** Write an i64 LE (bigint) into buffer at offset. Returns new offset. */
export function writeI64LE(
  buf: Buffer,
  offset: number,
  value: bigint,
): number {
  buf.writeBigInt64LE(value, offset);
  return offset + 8;
}

/** Write a PublicKey (32 bytes) into buffer at offset. Returns new offset. */
export function writePubkey(
  buf: Buffer,
  offset: number,
  pubkey: PublicKey,
): number {
  pubkey.toBuffer().copy(buf, offset);
  return offset + 32;
}
