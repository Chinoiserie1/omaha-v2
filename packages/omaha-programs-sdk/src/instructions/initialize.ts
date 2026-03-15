import type { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TransactionInstruction as TxInstruction } from "@solana/web3.js";

import {
  DISC_INITIALIZE,
  PROGRAM_AUTHORITY,
  SYSTEM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../constants.js";
import { writeU8, writeU16LE, writeU64LE } from "../utils.js";

export interface InitializeParams {
  readonly programAuthority?: PublicKey;
  readonly admin: PublicKey;
  readonly vaultState: PublicKey;
  readonly shareMint: PublicKey;
  readonly baseMint: PublicKey;
  readonly shareDecimals: number;
  readonly sharePrice: bigint;
  readonly name: string;
  readonly symbol: string;
  readonly uri: string;
  readonly programId?: PublicKey;
}

/**
 * Create an Initialize instruction (0x00).
 *
 * Data: [disc(1), share_decimals(1), share_price(8), name_len(2), name, symbol_len(2), symbol, uri_len(2), uri]
 *
 * Accounts:
 *   0. [signer]           program_authority — must match PROGRAM_AUTHORITY constant
 *   1. [signer, writable] admin
 *   2. [writable]         vault_state  — PDA: ["vault", name]
 *   3. [writable]         share_mint   — PDA: ["share_mint", vault_state]
 *   4. []                 base_mint
 *   5. []                 system_program
 *   6. []                 token_program — Token 2022
 */
export function createInitializeInstruction(
  params: InitializeParams,
): TransactionInstruction {
  const nameBytes = Buffer.from(params.name, "utf-8");
  const symbolBytes = Buffer.from(params.symbol, "utf-8");
  const uriBytes = Buffer.from(params.uri, "utf-8");

  const dataSize =
    1 + 1 + 8 + 2 + nameBytes.length + 2 + symbolBytes.length + 2 + uriBytes.length;
  const data = Buffer.alloc(dataSize);

  let offset = writeU8(data, 0, DISC_INITIALIZE);
  offset = writeU8(data, offset, params.shareDecimals);
  offset = writeU64LE(data, offset, params.sharePrice);
  offset = writeU16LE(data, offset, nameBytes.length);
  nameBytes.copy(data, offset);
  offset += nameBytes.length;
  offset = writeU16LE(data, offset, symbolBytes.length);
  symbolBytes.copy(data, offset);
  offset += symbolBytes.length;
  offset = writeU16LE(data, offset, uriBytes.length);
  uriBytes.copy(data, offset);

  const keys: AccountMeta[] = [
    { pubkey: params.programAuthority ?? PROGRAM_AUTHORITY, isSigner: true, isWritable: false },
    { pubkey: params.admin, isSigner: true, isWritable: true },
    { pubkey: params.vaultState, isSigner: false, isWritable: true },
    { pubkey: params.shareMint, isSigner: false, isWritable: true },
    { pubkey: params.baseMint, isSigner: false, isWritable: false },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TxInstruction({
    programId: params.programId ?? VAULT_PROGRAM_ID,
    keys,
    data,
  });
}
