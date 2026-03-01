import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { env } from "../utils/env.js";

// ── Constants ──────────────────────────────────────────────────
export const SHARE_TOKEN_DECIMALS = 6;
export const SHARE_TOKEN_MULTIPLIER = 10 ** SHARE_TOKEN_DECIMALS; // 1_000_000

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

export const GLAM_PROGRAM_ID = new PublicKey(env.GLAM_PROGRAM_ID);

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

// ── Keypair ────────────────────────────────────────────────────
function loadKeypair(): Keypair | null {
  const envKey = env.KEEPER_PRIVATE_KEY;
  if (!envKey) return null;

  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(envKey)));
  } catch {
    return Keypair.fromSecretKey(Buffer.from(envKey, "base64"));
  }
}

const _keeperKeypair = loadKeypair();

export function getKeeper(): Keypair {
  if (!_keeperKeypair) {
    throw new Error("KEEPER_PRIVATE_KEY is not set");
  }
  return _keeperKeypair;
}

// ── Vault PDA derivation ───────────────────────────────────────
export function deriveVaultPda(statePda: PublicKey): PublicKey {
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), statePda.toBuffer()],
    GLAM_PROGRAM_ID
  );
  return vaultPda;
}
