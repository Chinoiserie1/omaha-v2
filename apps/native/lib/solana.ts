import { Connection } from "@solana/web3.js";

export const SOLANA_RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

export function createConnection(): Connection {
  return new Connection(SOLANA_RPC_URL);
}
