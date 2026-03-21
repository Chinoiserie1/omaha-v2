/**
 * Transfer Factory Ownership (2-step process)
 *
 * Usage:
 *   # Step 1: Propose new owner
 *   pnpm transfer-factory-ownership propose \
 *     --keypair <owner-private-key>   \  # or ADMIN_PROGRAM_KEYPAIR env
 *     --new-owner <pubkey>            \
 *     --rpc-url <url>                 \  # or SOLANA_RPC_URL env
 *     --program-id <pubkey>              # optional, defaults to SDK
 *
 *   # Step 2: Accept ownership
 *   pnpm transfer-factory-ownership accept \
 *     --keypair <new-owner-private-key> \  # or NEW_OWNER_PRIVATE_KEY env
 *     --rpc-url <url>                   \  # or SOLANA_RPC_URL env
 *     --program-id <pubkey>                # optional
 */
import { PublicKey } from "@solana/web3.js";
import {
  findFactoryPda,
  deserializeFactoryState,
  createTransferFactoryOwnershipInstruction,
  createAcceptFactoryOwnershipInstruction,
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
      "  pnpm transfer-factory-ownership propose [options]\n" +
      "  pnpm transfer-factory-ownership accept [options]\n" +
      "\nOptions:\n" +
      "  --keypair <key>       Signer private key (base58/JSON/base64)\n" +
      "  --new-owner <pubkey>  New owner address (propose only)\n" +
      "  --rpc-url <url>       Solana RPC URL\n" +
      "  --program-id <pubkey> Vault program ID override\n" +
      "\nEnv fallbacks:\n" +
      "  ADMIN_PROGRAM_KEYPAIR     for --keypair (propose)\n" +
      "  NEW_OWNER_PRIVATE_KEY  for --keypair (accept)\n" +
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
  const [factoryPda] = findFactoryPda(programId ?? VAULT_PROGRAM_ID);
  const accountInfo = await connection.getAccountInfo(factoryPda);

  if (!accountInfo) {
    console.error("Factory account not found on-chain:", factoryPda.toBase58());
    process.exit(1);
  }
  const state = deserializeFactoryState(Buffer.from(accountInfo.data));

  if (step === "propose") {
    const signer = resolveKeypair(args, "--keypair", "ADMIN_PROGRAM_KEYPAIR");
    const newOwnerRaw = parseFlag(args, "--new-owner");
    if (!newOwnerRaw) {
      console.error("ERROR: --new-owner <pubkey> is required for propose.");
      printUsage();
    }
    const newOwner = new PublicKey(newOwnerRaw);

    console.log("Factory State:");
    console.log(`  PDA:            ${factoryPda.toBase58()}`);
    console.log(`  Current Owner:  ${state.owner.toBase58()}`);
    console.log(`  Pending Owner:  ${state.pendingOwner.toBase58()}`);
    console.log(`  Signer:         ${signer.publicKey.toBase58()}`);
    console.log(`  New Owner:      ${newOwner.toBase58()}`);
    console.log();

    if (!state.owner.equals(signer.publicKey)) {
      console.error(
        `ERROR: Signer (${signer.publicKey.toBase58()}) is not the current factory owner (${state.owner.toBase58()})`,
      );
      process.exit(1);
    }

    const ix = createTransferFactoryOwnershipInstruction({
      owner: signer.publicKey,
      factoryState: factoryPda,
      newOwner,
      ...(programId ? { programId } : {}),
    });

    const txSig = await sendTransaction(
      connection,
      signer,
      [ix],
      `Transfer factory ownership to ${newOwner.toBase58()}`,
    );

    console.log("Factory ownership transfer proposed!");
    console.log(`  Tx: ${txSig}`);
    console.log(`  Pending owner is now: ${newOwner.toBase58()}`);
    console.log("\nNext: The new owner must run 'accept' to finalize.");
  } else {
    const signer = resolveKeypair(args, "--keypair", "NEW_OWNER_PRIVATE_KEY");

    console.log("Factory State:");
    console.log(`  PDA:            ${factoryPda.toBase58()}`);
    console.log(`  Current Owner:  ${state.owner.toBase58()}`);
    console.log(`  Pending Owner:  ${state.pendingOwner.toBase58()}`);
    console.log(`  Signer:         ${signer.publicKey.toBase58()}`);
    console.log();

    if (!state.pendingOwner.equals(signer.publicKey)) {
      console.error(
        `ERROR: Signer (${signer.publicKey.toBase58()}) does not match pending owner (${state.pendingOwner.toBase58()})`,
      );
      process.exit(1);
    }

    const ix = createAcceptFactoryOwnershipInstruction({
      newOwner: signer.publicKey,
      factoryState: factoryPda,
      ...(programId ? { programId } : {}),
    });

    const txSig = await sendTransaction(
      connection,
      signer,
      [ix],
      "Accept factory ownership",
    );

    console.log("Factory ownership accepted!");
    console.log(`  Tx: ${txSig}`);
    console.log(`  New owner: ${signer.publicKey.toBase58()}`);
  }
}

main().catch((error) => {
  console.error("Transfer factory ownership failed:", error);
  process.exit(1);
});
