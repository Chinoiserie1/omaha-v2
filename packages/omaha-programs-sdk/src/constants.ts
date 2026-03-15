import { PublicKey } from "@solana/web3.js";

// ── Program ID ──────────────────────────────────────────────────────────────
// TODO: Replace with actual deployed program address for mainnet
export const VAULT_PROGRAM_ID = new PublicKey(
  "5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR",
);

// ── Program Authority ───────────────────────────────────────────────────────
// TODO: Replace with actual program authority keypair before mainnet deploy
// Only this pubkey can co-sign Initialize instructions to create new vaults.
export const PROGRAM_AUTHORITY = new PublicKey(
  "9hLNRfyFw32aU6xyKZHSUSJt3N2QC9oen8HDqPyJ3Ryf",
);

// ── Instruction Discriminators (0x00–0x0C): Vault Operations ─────────────────
export const DISC_INITIALIZE = 0x00 as const;
export const DISC_ADD_OWNER = 0x01 as const;
export const DISC_REMOVE_OWNER = 0x02 as const;
export const DISC_SET_SHARE_PRICE = 0x03 as const;
export const DISC_EXECUTE = 0x04 as const;
export const DISC_UPDATE_FEES = 0x05 as const;
export const DISC_COLLECT_FEES = 0x06 as const;
export const DISC_DEPOSIT_WITH_PRICE = 0x07 as const;
export const DISC_REQUEST_DEPOSIT = 0x08 as const;
export const DISC_FULFILL_DEPOSIT = 0x09 as const;
export const DISC_WITHDRAW_WITH_PRICE = 0x0a as const;
export const DISC_REQUEST_WITHDRAW = 0x0b as const;
export const DISC_FULFILL_WITHDRAW = 0x0c as const;

// ── Instruction Discriminators (0x0D–0x13): Factory Management ───────────────
export const DISC_INITIALIZE_FACTORY = 0x0d as const;
export const DISC_ADD_FACTORY_ADMIN = 0x0e as const;
export const DISC_REMOVE_FACTORY_ADMIN = 0x0f as const;
export const DISC_TRANSFER_FACTORY_OWNERSHIP = 0x10 as const;
export const DISC_ACCEPT_FACTORY_OWNERSHIP = 0x11 as const;
export const DISC_PAUSE_FACTORY = 0x12 as const;
export const DISC_UNPAUSE_FACTORY = 0x13 as const;

// ── Instruction Discriminators (0x14–0x19): Vault Admin Transfer & Pause ─────
export const DISC_TRANSFER_VAULT_ADMIN = 0x14 as const;
export const DISC_ACCEPT_VAULT_ADMIN = 0x15 as const;
export const DISC_PAUSE_VAULT = 0x16 as const;
export const DISC_UNPAUSE_VAULT = 0x17 as const;
export const DISC_CANCEL_DEPOSIT = 0x18 as const;
export const DISC_CANCEL_WITHDRAW = 0x19 as const;

// ── Account Discriminators ──────────────────────────────────────────────────
export const VAULT_DISCRIMINATOR = 0xa1 as const;
export const PENDING_DEPOSIT_DISCRIMINATOR = 0xa2 as const;
export const PENDING_WITHDRAW_DISCRIMINATOR = 0xa3 as const;
export const FACTORY_DISCRIMINATOR = 0xa4 as const;

// ── Account Sizes (bytes) ───────────────────────────────────────────────────
export const VAULT_STATE_SIZE = 584 as const;
export const PENDING_DEPOSIT_SIZE = 88 as const;
export const PENDING_WITHDRAW_SIZE = 88 as const;
export const FACTORY_STATE_SIZE = 400 as const;

// ── Max Counts ──────────────────────────────────────────────────────────────
export const MAX_OWNERS = 10 as const;
export const MAX_OPERATORS = 10 as const;
export const MAX_FACTORY_ADMINS = 10 as const;

// ── Token Programs ──────────────────────────────────────────────────────────
export const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

// ── System Program ──────────────────────────────────────────────────────────
export const SYSTEM_PROGRAM_ID = new PublicKey(
  "11111111111111111111111111111111",
);

// ── Clock Sysvar ──────────────────────────────────────────────────────────
export const CLOCK_SYSVAR_ID = new PublicKey(
  "SysvarC1ock11111111111111111111111111111111",
);

// ── Pending Expiry ────────────────────────────────────────────────────────
export const PENDING_EXPIRY_SECONDS = 172_800 as const;

// ── Operator Discriminator Aliases ────────────────────────────────────────
export const DISC_ADD_OPERATOR = DISC_ADD_OWNER;
export const DISC_REMOVE_OPERATOR = DISC_REMOVE_OWNER;

// ── Fee Constants ───────────────────────────────────────────────────────────
export const BPS_DENOMINATOR = 10_000n;
export const SECONDS_PER_YEAR = 31_557_600n;
export const MAX_ENTRY_EXIT_FEE_BPS = 1_000;
export const MAX_MANAGEMENT_FEE_BPS = 1_000;
export const MAX_PERFORMANCE_FEE_BPS = 5_000;
