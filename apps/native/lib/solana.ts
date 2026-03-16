import { Connection } from "@solana/web3.js";

export const SOLANA_RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const USDC_MINT =
  process.env.EXPO_PUBLIC_USDC_MINT ??
  (process.env.EXPO_PUBLIC_SOLANA_NETWORK === "devnet"
    ? DEVNET_USDC
    : MAINNET_USDC);

export function createConnection(): Connection {
  return new Connection(SOLANA_RPC_URL);
}
