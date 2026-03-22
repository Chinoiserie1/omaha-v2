import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";

// ── Constants ──────────────────────────────────────────────────
export const SHARE_TOKEN_DECIMALS = 6;
export const SHARE_TOKEN_MULTIPLIER = 10 ** SHARE_TOKEN_DECIMALS; // 1_000_000

const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const USDC_MINT = new PublicKey(
  env.USDC_MINT ?? (env.SOLANA_NETWORK === "devnet" ? DEVNET_USDC : MAINNET_USDC),
);
export const USDC_DECIMALS = 6;

export const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
);
export const SOL_DECIMALS = 9;

// ── Connection (singleton) ─────────────────────────────────────
let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    if (!env.SOLANA_RPC_URL) {
      throw new Error("SOLANA_RPC_URL is not set");
    }
    _connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  }
  return _connection;
}

// ── Keypair helpers ─────────────────────────────────────────────
function keypairFromEnv(raw: string): Keypair {
  const bytes = (() => {
    try {
      return Uint8Array.from(JSON.parse(raw));
    } catch {
      // Try base58 first (Phantom export format), then base64
      try {
        return bs58.decode(raw);
      } catch {
        return Buffer.from(raw, "base64");
      }
    }
  })();

  // 64 bytes = full secret key, 32 bytes = seed-only (private key)
  if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  if (bytes.length === 32) return Keypair.fromSeed(bytes);
  throw new Error(`unexpected key length: ${bytes.length} (expected 32 or 64)`);
}

function loadKeypair(): Keypair | null {
  const envKey = env.ADMIN_PROGRAM_PRIVATE_KEY;
  if (!envKey) return null;
  return keypairFromEnv(envKey);
}

const _adminKeypair = loadKeypair();

export function getAdmin(): Keypair {
  if (!_adminKeypair) {
    throw new Error("ADMIN_PROGRAM_PRIVATE_KEY is not set");
  }
  return _adminKeypair;
}

// ── Fee Payer Keypair ──────────────────────────────────────────
function loadFeePayerKeypair(): Keypair | null {
  const envKey = env.FEE_PAYER_PRIVATE_KEY;
  if (!envKey) {
    logger.info("FEE_PAYER_PRIVATE_KEY not set — fund-sol fee payer disabled");
    return null;
  }

  try {
    return keypairFromEnv(envKey);
  } catch (err) {
    logger.error(
      { err },
      "FEE_PAYER_PRIVATE_KEY is set but could not be parsed",
    );
    return null;
  }
}

const _feePayerKeypair = loadFeePayerKeypair();

export function getFeePayer(): Keypair {
  if (!_feePayerKeypair) {
    throw new Error("FEE_PAYER_PRIVATE_KEY is not set");
  }
  return _feePayerKeypair;
}

// ── Program Authority Keypair ──────────────────────────────────
function loadProgramAuthorityKeypair(): Keypair | null {
  const envKey = env.PROGRAM_AUTHORITY_PRIVATE_KEY;
  if (!envKey) return null;
  try {
    return keypairFromEnv(envKey);
  } catch (err) {
    logger.error(
      { err },
      "PROGRAM_AUTHORITY_PRIVATE_KEY is set but could not be parsed",
    );
    return null;
  }
}

const _programAuthorityKeypair = loadProgramAuthorityKeypair();

export function getProgramAuthority(): Keypair {
  if (!_programAuthorityKeypair) {
    throw new Error("PROGRAM_AUTHORITY_PRIVATE_KEY is not set");
  }
  return _programAuthorityKeypair;
}
