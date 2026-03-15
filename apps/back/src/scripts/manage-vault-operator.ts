/**
 * Add or Remove a Vault Operator
 *
 * Usage:
 *   pnpm manage-vault-operator add [options]
 *   pnpm manage-vault-operator remove [options]
 *
 * Options:
 *   --keypair <key>       Vault admin private key (base58/JSON/base64)
 *   --vault-name <name>   Vault name (used for PDA derivation)
 *   --operator <pubkey>   Operator address to add or remove
 *   --rpc-url <url>       Solana RPC URL
 *   --program-id <pubkey> Vault program ID override
 *
 * Env fallbacks:
 *   KEEPER_PRIVATE_KEY    for --keypair
 *   SOLANA_RPC_URL        for --rpc-url
 */
import { PublicKey } from "@solana/web3.js";
import {
  findVaultStatePda,
  deserializeVaultState,
  createAddOwnerInstruction,
  createRemoveOwnerInstruction,
  VAULT_PROGRAM_ID,
} from "@repo/omaha-programs-sdk";
import {
  positionalArgs,
  parseFlag,
  resolveKeypair,
  resolveConnection,
  resolveProgramId,
  sendTransaction,
} from "./script-args.js";

function printUsage(): never {
  console.error(
    "Usage:\n" +
      "  pnpm manage-vault-operator add [options]\n" +
      "  pnpm manage-vault-operator remove [options]\n" +
      "\nOptions:\n" +
      "  --keypair <key>       Vault admin private key (base58/JSON/base64)\n" +
      "  --vault-name <name>   Vault name (used for PDA derivation)\n" +
      "  --operator <pubkey>   Operator address to add or remove\n" +
      "  --rpc-url <url>       Solana RPC URL\n" +
      "  --program-id <pubkey> Vault program ID override\n" +
      "\nEnv fallbacks:\n" +
      "  KEEPER_PRIVATE_KEY    for --keypair\n" +
      "  SOLANA_RPC_URL        for --rpc-url\n",
  );
  process.exit(1);
}

function printOperators(operators: readonly PublicKey[], numOperators: number) {
  console.log(`  Operator count: ${numOperators}`);
  for (let i = 0; i < operators.length; i++) {
    console.log(`  Operator [${i}]: ${operators[i]!.toBase58()}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [action] = positionalArgs(args);

  if (action !== "add" && action !== "remove") {
    printUsage();
  }

  const connection = resolveConnection(args);
  const signer = resolveKeypair(args, "--keypair", "KEEPER_PRIVATE_KEY");
  const programId = resolveProgramId(args, PublicKey);

  const vaultName = parseFlag(args, "--vault-name");
  if (!vaultName) {
    console.error("ERROR: --vault-name <name> is required.");
    printUsage();
  }

  const operatorRaw = parseFlag(args, "--operator");
  if (!operatorRaw) {
    console.error("ERROR: --operator <pubkey> is required.");
    printUsage();
  }
  const operatorPubkey = new PublicKey(operatorRaw);

  const [vaultPda] = findVaultStatePda(vaultName, programId ?? VAULT_PROGRAM_ID);
  const accountInfo = await connection.getAccountInfo(vaultPda);
  if (!accountInfo) {
    console.error(`Vault "${vaultName}" not found on-chain: ${vaultPda.toBase58()}`);
    process.exit(1);
  }
  const state = deserializeVaultState(Buffer.from(accountInfo.data));

  console.log("Vault State:");
  console.log(`  Name:   ${state.vaultName}`);
  console.log(`  PDA:    ${vaultPda.toBase58()}`);
  console.log(`  Admin:  ${state.admin.toBase58()}`);
  printOperators(state.operators, state.numOperators);
  console.log(`  Signer: ${signer.publicKey.toBase58()}`);
  console.log(`  Action: ${action} ${operatorPubkey.toBase58()}`);
  console.log();

  if (!state.admin.equals(signer.publicKey)) {
    console.error(
      `ERROR: Signer (${signer.publicKey.toBase58()}) is not the vault admin (${state.admin.toBase58()})`,
    );
    process.exit(1);
  }

  if (action === "add") {
    const ix = createAddOwnerInstruction({
      admin: signer.publicKey,
      vaultState: vaultPda,
      newOwner: operatorPubkey,
      ...(programId ? { programId } : {}),
    });

    const txSig = await sendTransaction(
      connection,
      signer,
      [ix],
      `Add operator ${operatorPubkey.toBase58()} to vault "${vaultName}"`,
    );

    console.log("Vault operator added!");
    console.log(`  Tx: ${txSig}`);
    console.log(`  New operator: ${operatorPubkey.toBase58()}`);
  } else {
    const ix = createRemoveOwnerInstruction({
      admin: signer.publicKey,
      vaultState: vaultPda,
      ownerToRemove: operatorPubkey,
      ...(programId ? { programId } : {}),
    });

    const txSig = await sendTransaction(
      connection,
      signer,
      [ix],
      `Remove operator ${operatorPubkey.toBase58()} from vault "${vaultName}"`,
    );

    console.log("Vault operator removed!");
    console.log(`  Tx: ${txSig}`);
    console.log(`  Removed: ${operatorPubkey.toBase58()}`);
  }
}

main().catch((error) => {
  console.error("Manage vault operator failed:", error);
  process.exit(1);
});
