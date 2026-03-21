/**
 * Transfer Vault Admin (2-step process)
 *
 * Usage:
 *   # Step 1: Propose new admin
 *   pnpm transfer-vault-admin propose \
 *     --keypair <admin-private-key>  \  # or ADMIN_PROGRAM_KEYPAIR env
 *     --vault-name <name>            \
 *     --new-admin <pubkey>           \
 *     --rpc-url <url>                \  # or SOLANA_RPC_URL env
 *     --program-id <pubkey>             # optional
 *
 *   # Step 2: Accept admin role
 *   pnpm transfer-vault-admin accept \
 *     --keypair <new-admin-key>      \  # or NEW_ADMIN_PRIVATE_KEY env
 *     --vault-name <name>            \
 *     --rpc-url <url>                \  # or SOLANA_RPC_URL env
 *     --program-id <pubkey>             # optional
 */
import { PublicKey } from "@solana/web3.js";
import {
  findVaultStatePda,
  deserializeVaultState,
  createTransferVaultAdminInstruction,
  createAcceptVaultAdminInstruction,
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
      "  pnpm transfer-vault-admin propose [options]\n" +
      "  pnpm transfer-vault-admin accept [options]\n" +
      "\nOptions:\n" +
      "  --keypair <key>       Signer private key (base58/JSON/base64)\n" +
      "  --vault-name <name>   Vault name (used for PDA derivation)\n" +
      "  --new-admin <pubkey>  New admin address (propose only)\n" +
      "  --rpc-url <url>       Solana RPC URL\n" +
      "  --program-id <pubkey> Vault program ID override\n" +
      "\nEnv fallbacks:\n" +
      "  ADMIN_PROGRAM_KEYPAIR     for --keypair (propose)\n" +
      "  NEW_ADMIN_PRIVATE_KEY  for --keypair (accept)\n" +
      "  SOLANA_RPC_URL         for --rpc-url\n",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [step] = positionalArgs(args);

  if (step !== "propose" && step !== "accept") {
    printUsage();
  }

  const connection = resolveConnection(args);
  const programId = resolveProgramId(args, PublicKey);

  const vaultName = parseFlag(args, "--vault-name");
  if (!vaultName) {
    console.error("ERROR: --vault-name <name> is required.");
    printUsage();
  }

  const [vaultPda] = findVaultStatePda(vaultName, programId ?? VAULT_PROGRAM_ID);
  const accountInfo = await connection.getAccountInfo(vaultPda);
  if (!accountInfo) {
    console.error(`Vault "${vaultName}" not found on-chain: ${vaultPda.toBase58()}`);
    process.exit(1);
  }
  const state = deserializeVaultState(Buffer.from(accountInfo.data));

  if (step === "propose") {
    const signer = resolveKeypair(args, "--keypair", "ADMIN_PROGRAM_KEYPAIR");

    const newAdminRaw = parseFlag(args, "--new-admin");
    if (!newAdminRaw) {
      console.error("ERROR: --new-admin <pubkey> is required for propose.");
      printUsage();
    }
    const newAdmin = new PublicKey(newAdminRaw);

    console.log("Vault State:");
    console.log(`  Name:           ${state.vaultName}`);
    console.log(`  PDA:            ${vaultPda.toBase58()}`);
    console.log(`  Current Admin:  ${state.admin.toBase58()}`);
    console.log(`  Pending Admin:  ${state.pendingAdmin.toBase58()}`);
    console.log(`  Signer:         ${signer.publicKey.toBase58()}`);
    console.log(`  New Admin:      ${newAdmin.toBase58()}`);
    console.log();

    if (!state.admin.equals(signer.publicKey)) {
      console.error(
        `ERROR: Signer (${signer.publicKey.toBase58()}) is not the current vault admin (${state.admin.toBase58()})`,
      );
      process.exit(1);
    }

    const ix = createTransferVaultAdminInstruction({
      admin: signer.publicKey,
      vaultState: vaultPda,
      newAdmin,
      ...(programId ? { programId } : {}),
    });

    const txSig = await sendTransaction(
      connection,
      signer,
      [ix],
      `Transfer vault admin for "${vaultName}" to ${newAdmin.toBase58()}`,
    );

    console.log("Vault admin transfer proposed!");
    console.log(`  Tx: ${txSig}`);
    console.log(`  Pending admin is now: ${newAdmin.toBase58()}`);
    console.log("\nNext: The new admin must run 'accept' to finalize.");
  } else {
    const signer = resolveKeypair(args, "--keypair", "NEW_ADMIN_PRIVATE_KEY");

    console.log("Vault State:");
    console.log(`  Name:           ${state.vaultName}`);
    console.log(`  PDA:            ${vaultPda.toBase58()}`);
    console.log(`  Current Admin:  ${state.admin.toBase58()}`);
    console.log(`  Pending Admin:  ${state.pendingAdmin.toBase58()}`);
    console.log(`  Signer:         ${signer.publicKey.toBase58()}`);
    console.log();

    if (!state.pendingAdmin.equals(signer.publicKey)) {
      console.error(
        `ERROR: Signer (${signer.publicKey.toBase58()}) does not match pending admin (${state.pendingAdmin.toBase58()})`,
      );
      process.exit(1);
    }

    const ix = createAcceptVaultAdminInstruction({
      newAdmin: signer.publicKey,
      vaultState: vaultPda,
      ...(programId ? { programId } : {}),
    });

    const txSig = await sendTransaction(
      connection,
      signer,
      [ix],
      `Accept vault admin for "${vaultName}"`,
    );

    console.log("Vault admin transfer accepted!");
    console.log(`  Tx: ${txSig}`);
    console.log(`  New admin: ${signer.publicKey.toBase58()}`);
  }
}

main().catch((error) => {
  console.error("Transfer vault admin failed:", error);
  process.exit(1);
});
