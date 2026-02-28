import { createHash } from "node:crypto";
import { env } from "../utils/env.js";

/**
 * Deterministic batch ID based on vault + time window.
 * All requests within the same window map to the same batch.
 */
export function computeBatchId(
  vaultId: string,
  timestampMs: number,
): string {
  const window = Math.floor(timestampMs / env.WITHDRAWAL_BATCH_WINDOW_MS);
  return `${vaultId}:${window}`;
}

/**
 * Idempotency key: prevents duplicate withdrawal requests
 * from the same user in the same batch window.
 */
export function computeIdempotencyKey(
  userId: string,
  vaultId: string,
  batchId: string,
): string {
  return createHash("sha256")
    .update(`${userId}:${vaultId}:${batchId}`)
    .digest("hex");
}

/**
 * Remaining time (ms) until the current batch window expires.
 */
export function remainingBatchWindowMs(timestampMs: number): number {
  const windowMs = env.WITHDRAWAL_BATCH_WINDOW_MS;
  const elapsed = timestampMs % windowMs;
  return windowMs - elapsed;
}
