import { PublicKey } from "@solana/web3.js";

import { VAULT_PROGRAM_ID } from "./constants.js";

/**
 * Derive vault state PDA.
 * Seeds: ["vault", admin_pubkey, base_mint]
 */
export function findVaultStatePda(
  admin: PublicKey,
  baseMint: PublicKey,
  programId: PublicKey = VAULT_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), admin.toBuffer(), baseMint.toBuffer()],
    programId,
  );
}

/**
 * Derive share mint PDA.
 * Seeds: ["share_mint", vault_state_pubkey]
 */
export function findShareMintPda(
  vaultState: PublicKey,
  programId: PublicKey = VAULT_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("share_mint"), vaultState.toBuffer()],
    programId,
  );
}

/**
 * Derive pending deposit PDA.
 * Seeds: ["pending_deposit", vault_state_pubkey, depositor_pubkey]
 */
export function findPendingDepositPda(
  vaultState: PublicKey,
  depositor: PublicKey,
  programId: PublicKey = VAULT_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("pending_deposit"),
      vaultState.toBuffer(),
      depositor.toBuffer(),
    ],
    programId,
  );
}

/**
 * Derive pending withdraw PDA.
 * Seeds: ["pending_withdraw", vault_state_pubkey, withdrawer_pubkey]
 */
export function findPendingWithdrawPda(
  vaultState: PublicKey,
  withdrawer: PublicKey,
  programId: PublicKey = VAULT_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("pending_withdraw"),
      vaultState.toBuffer(),
      withdrawer.toBuffer(),
    ],
    programId,
  );
}
