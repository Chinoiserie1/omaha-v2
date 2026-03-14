import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import { DISC_EXECUTE, VAULT_PROGRAM_ID } from "../constants.js";

export interface ExecuteParams {
  readonly operator: PublicKey;
  readonly vaultState: PublicKey;
  readonly targetProgram: PublicKey;
  readonly remainingAccounts: readonly AccountMeta[];
  readonly targetInstructionData: Buffer;
  readonly programId?: PublicKey;
}

/**
 * Create an Execute instruction (0x04).
 *
 * Data: [disc(1), ...target_instruction_data]
 *
 * Accounts:
 *   0. [signer] operator       — must be admin or owner
 *   1. []       vault_state    — vault config PDA
 *   2. []       target_program — the program to CPI into
 *   3..N        remaining_accounts — forwarded to target program
 */
export function createExecuteInstruction(
  params: ExecuteParams,
): TransactionInstruction {
  const data = Buffer.alloc(1 + params.targetInstructionData.length);
  data.writeUInt8(DISC_EXECUTE, 0);
  params.targetInstructionData.copy(data, 1);

  const keys: AccountMeta[] = [
    { pubkey: params.operator, isSigner: true, isWritable: false },
    { pubkey: params.vaultState, isSigner: false, isWritable: false },
    { pubkey: params.targetProgram, isSigner: false, isWritable: false },
    ...params.remainingAccounts,
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
