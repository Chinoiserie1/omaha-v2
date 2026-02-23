import { z } from "zod";

export const walletAddressSchema = z.object({
  address: z
    .string()
    .min(32, "Invalid Solana address")
    .max(44, "Invalid Solana address"),
});
