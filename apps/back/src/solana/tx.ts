import {
  type AddressLookupTableAccount,
  ComputeBudgetProgram,
  type Keypair,
  PublicKey,
  type TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { getConnection, getKeeper } from "./config.js";
import { logger } from "../utils/logger.js";

/**
 * Resolve Address Lookup Table accounts from on-chain data.
 */
async function resolveAltAccounts(
  altAddresses: string[]
): Promise<AddressLookupTableAccount[]> {
  if (altAddresses.length === 0) return [];

  const connection = getConnection();
  const results: AddressLookupTableAccount[] = [];

  for (const addr of altAddresses) {
    const pubkey = new PublicKey(addr);
    const res = await connection.getAddressLookupTable(pubkey);
    if (res.value) {
      results.push(res.value);
    } else {
      logger.warn({ alt: addr }, "Failed to resolve ALT");
    }
  }

  return results;
}

/**
 * Build a versioned transaction with compute budget and ALT support,
 * sign with keeper, send, and confirm.
 */
export async function buildAndSendVersionedTx(
  instructions: TransactionInstruction[],
  description: string,
  altAddresses: string[] = [],
  additionalSigners: Keypair[] = [],
): Promise<string> {
  const connection = getConnection();
  const keeper = getKeeper();

  const allIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ...instructions,
  ];

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const altAccounts = await resolveAltAccounts(altAddresses);

  const messageV0 = new TransactionMessage({
    payerKey: keeper.publicKey,
    recentBlockhash: blockhash,
    instructions: allIxs,
  }).compileToV0Message(altAccounts.length > 0 ? altAccounts : undefined);

  const tx = new VersionedTransaction(messageV0);
  tx.sign([keeper, ...additionalSigners]);

  logger.info({ description }, "Sending transaction...");
  const sig = await connection.sendTransaction(tx, { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");

  logger.info({ sig, description }, "Transaction confirmed");
  return sig;
}
