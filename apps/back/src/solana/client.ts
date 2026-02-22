import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import { GlamClient, ClusterNetwork } from "@glamsystems/glam-sdk";
import { getConnection, getKeeper } from "./config.js";
import { logger } from "../utils/logger.js";

const clientCache = new Map<string, GlamClient>();

/**
 * Get or create a GlamClient bound to a specific vault.
 */
export function getGlamClient(statePda: PublicKey): GlamClient {
  const key = statePda.toBase58();
  const cached = clientCache.get(key);
  if (cached) return cached;

  const connection = getConnection();
  const keeper = getKeeper();
  const wallet = new Wallet(keeper);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const client = new GlamClient({
    provider,
    wallet,
    cluster: ClusterNetwork.Mainnet,
    statePda,
  });

  clientCache.set(key, client);
  logger.debug({ vault: key }, "GLAM client created");
  return client;
}

/**
 * Get a GlamClient without a bound vault (for vault creation).
 */
export function getGlamClientForCreation(): GlamClient {
  const connection = getConnection();
  const keeper = getKeeper();
  const wallet = new Wallet(keeper);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    skipPreflight: true,
    maxRetries: 5,
  });

  return new GlamClient({
    provider,
    wallet,
    cluster: ClusterNetwork.Mainnet,
  });
}
