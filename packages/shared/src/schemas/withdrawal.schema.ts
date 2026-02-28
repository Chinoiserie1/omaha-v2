import { z } from "zod";

export const createWithdrawalSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  signerPublicKey: z.string().min(32, "Invalid signer public key"),
});

export const claimWithdrawalSchema = z.object({
  signerPublicKey: z.string().min(32, "Invalid signer public key"),
});

export const confirmClaimSchema = z.object({
  txSignature: z.string().min(64, "Invalid transaction signature"),
});

export const retryWithdrawalSchema = z.object({
  withdrawalId: z.string().min(1, "Withdrawal ID is required"),
});

export const withdrawalStatusValues = [
  "REQUESTED",
  "PROCESSING",
  "CLAIMABLE",
  "CLAIMED",
  "FAILED",
] as const;

export const withdrawalStatusSchema = z.enum(withdrawalStatusValues);
