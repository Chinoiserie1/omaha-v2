import type { WithdrawalRequest } from "@repo/database";
import { env } from "../../../utils/env.js";

/**
 * Enrich a withdrawal record with computed fields for the API response.
 * - estimatedFulfillAt: when the fulfill step is expected to complete
 *   (only meaningful when status is PROCESSING).
 */
export function enrichWithdrawal(
  withdrawal: WithdrawalRequest,
): WithdrawalRequest & { estimatedFulfillAt: string | null } {
  const estimatedFulfillAt = computeEstimatedFulfillAt(withdrawal);
  return { ...withdrawal, estimatedFulfillAt };
}

function computeEstimatedFulfillAt(
  withdrawal: WithdrawalRequest,
): string | null {
  if (withdrawal.status !== "PROCESSING" || !withdrawal.processingAt) {
    return null;
  }

  const processingTime = new Date(withdrawal.processingAt).getTime();
  const estimated = processingTime + env.WITHDRAWAL_BATCH_WINDOW_MS;
  return new Date(estimated).toISOString();
}
