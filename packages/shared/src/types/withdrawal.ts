export type WithdrawalStatus =
  | "REQUESTED"
  | "PROCESSING"
  | "CLAIMABLE"
  | "CLAIMED"
  | "FAILED"
  | "REMOVED";

export interface WithdrawalRequest {
  id: string;
  userId: string;
  kolVaultId: string;
  amount: number;
  status: WithdrawalStatus;
  idempotencyKey: string;
  batchId: string;
  redeemTxSignature: string | null;
  claimTxSignature: string | null;
  errorMessage: string | null;
  errorCount: number;
  removedReason: string | null;
  requestedAt: string;
  processingAt: string | null;
  claimableAt: string | null;
  claimedAt: string | null;
  failedAt: string | null;
  estimatedFulfillAt: string | null;
}

export interface WithdrawalStatusUpdate {
  withdrawalId: string;
  status: WithdrawalStatus;
  timestamp: string;
  redeemTxSignature?: string;
  claimTxSignature?: string;
  errorMessage?: string;
}
