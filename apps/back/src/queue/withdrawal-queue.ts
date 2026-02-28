import { Queue } from "bullmq";
import { getRedisConnectionConfig } from "../infra/redis-config.js";

export interface WithdrawalJobData {
  batchId: string;
  vaultId: string;
}

export interface WithdrawalJobResult {
  processedCount: number;
  failedCount: number;
}

const QUEUE_NAME = "withdrawal";

let queue: Queue<WithdrawalJobData, WithdrawalJobResult> | null = null;

export function getWithdrawalQueue(): Queue<
  WithdrawalJobData,
  WithdrawalJobResult
> {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 86_400 }, // 24h
        removeOnFail: { age: 604_800 }, // 7d
      },
    });
  }
  return queue;
}

export async function enqueueWithdrawalBatch(
  batchId: string,
  vaultId: string,
  delayMs: number,
): Promise<void> {
  const q = getWithdrawalQueue();

  // Deduplicate: use batchId as jobId so duplicate enqueues are no-ops
  await q.add(
    `batch:${batchId}`,
    { batchId, vaultId },
    { delay: delayMs, jobId: batchId },
  );
}

export async function closeWithdrawalQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
