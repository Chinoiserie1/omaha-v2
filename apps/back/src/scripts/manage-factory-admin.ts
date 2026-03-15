/**
 * Add or Remove a Factory Admin
 *
 * Usage:
 *   pnpm manage-factory-admin add [options]
 *   pnpm manage-factory-admin remove [options]
 *
 * Options:
 *   --keypair <key>       Factory owner private key (base58/JSON/base64)
 *   --admin <pubkey>      Admin address to add or remove
 *   --rpc-url <url>       Solana RPC URL
 *   --program-id <pubkey> Vault program ID override
 *
 * Env fallbacks:
 *   KEEPER_PRIVATE_KEY    for --keypair
 *   SOLANA_RPC_URL        for --rpc-url
 */
import { PublicKey } from "@solana/web3.js";
import {
  findFactoryPda,
  deserializeFactoryState,
  createAddFactoryAdminInstruction,
  createRemoveFactoryAdminInstruction,
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
      "  pnpm manage-factory-admin add [options]\n" +
      "  pnpm manage-factory-admin remove [options]\n" +
      "\nOptions:\n" +
      "  --keypair <key>       Factory owner private key (base58/JSON/base64)\n" +
      "  --admin <pubkey>      Admin address to add or remove\n" +
      "  --rpc-url <url>       Solana RPC URL\n" +
      "  --program-id <pubkey> Vault program ID override\n" +
      "\nEnv fallbacks:\n" +
      "  KEEPER_PRIVATE_KEY    for --keypair\n" +
      "  SOLANA_RPC_URL        for --rpc-url\n",
  );
  process.exit(1);
}

function printAdmins(admins: readonly PublicKey[], numAdmins: number) {
  console.log(`  Admin count: ${numAdmins}`);
  for (let i = 0; i < admins.length; i++) {
    console.log(`  Admin [${i}]: ${admins[i]!.toBase58()}`);
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

  const adminRaw = parseFlag(args, "--admin");
  if (!adminRaw) {
    console.error("ERROR: --admin <pubkey> is required.");
    printUsage();
  }
  const adminPubkey = new PublicKey(adminRaw);

  const [factoryPda] = findFactoryPda(programId ?? VAULT_PROGRAM_ID);
  const accountInfo = await connection.getAccountInfo(factoryPda);
  if (!accountInfo) {
    console.error("Factory account not found on-chain:", factoryPda.toBase58());
    process.exit(1);
  }
  const state = deserializeFactoryState(Buffer.from(accountInfo.data));

  console.log("Factory State:");
  console.log(`  PDA:    ${factoryPda.toBase58()}`);
  console.log(`  Owner:  ${state.owner.toBase58()}`);
  printAdmins(state.admins, state.numAdmins);
  console.log(`  Signer: ${signer.publicKey.toBase58()}`);
  console.log(`  Action: ${action} ${adminPubkey.toBase58()}`);
  console.log();

  if (!state.owner.equals(signer.publicKey)) {
    console.error(
      `ERROR: Signer (${signer.publicKey.toBase58()}) is not the factory owner (${state.owner.toBase58()})`,
    );
    process.exit(1);
  }

  if (action === "add") {
    const ix = createAddFactoryAdminInstruction({
      owner: signer.publicKey,
      factoryState: factoryPda,
      newAdmin: adminPubkey,
      ...(programId ? { programId } : {}),
    });

    const txSig = await sendTransaction(
      connection,
      signer,
      [ix],
      `Add factory admin ${adminPubkey.toBase58()}`,
    );

    console.log("Factory admin added!");
    console.log(`  Tx: ${txSig}`);
    console.log(`  New admin: ${adminPubkey.toBase58()}`);
  } else {
    const ix = createRemoveFactoryAdminInstruction({
      owner: signer.publicKey,
      factoryState: factoryPda,
      adminToRemove: adminPubkey,
      ...(programId ? { programId } : {}),
    });

    const txSig = await sendTransaction(
      connection,
      signer,
      [ix],
      `Remove factory admin ${adminPubkey.toBase58()}`,
    );

    console.log("Factory admin removed!");
    console.log(`  Tx: ${txSig}`);
    console.log(`  Removed: ${adminPubkey.toBase58()}`);
  }
}

main().catch((error) => {
  console.error("Manage factory admin failed:", error);
  process.exit(1);
});
