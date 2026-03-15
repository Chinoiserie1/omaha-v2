import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_UNPAUSE_VAULT, VAULT_PROGRAM_ID } from "../constants.js";
import { writeU8 } from "../utils.js";

export interface UnpauseVaultParams {
  readonly authority: PublicKey;
  readonly vaultState: PublicKey;
  readonly factoryState?: PublicKey;
  readonly programId?: PublicKey;
}

/**
 * Create an UnpauseVault instruction (0x17).
 *
 * Data: [disc(1)] = 1 byte
 *
 * Accounts:
 *   0. [signer]   authority — vault admin or factory owner
 *   1. [writable] vault_state
 *   2. []         factory_state (optional — required when authority is factory owner, not vault admin)
 */
export function createUnpauseVaultInstruction(
  params: UnpauseVaultParams,
): TransactionInstruction {
  const data = Buffer.alloc(1);
  writeU8(data, 0, DISC_UNPAUSE_VAULT);

  const keys: AccountMeta[] = [
    { pubkey: params.authority, isSigner: true, isWritable: false },
    { pubkey: params.vaultState, isSigner: false, isWritable: true },
  ];

  if (params.factoryState !== undefined) {
    keys.push({ pubkey: params.factoryState, isSigner: false, isWritable: false });
  }

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
