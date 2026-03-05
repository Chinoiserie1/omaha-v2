import { prisma } from "@repo/database";
import { PublicKey } from "@solana/web3.js";
import { createQuantVault, enableJupiterIntegration } from "../solana/vault-setup.js";
import { deriveVaultPda } from "../solana/config.js";

function parseArgs(args: string[]): {
  quantId: string;
  dryRun: boolean;
} {
  const positional: string[] = [];
  let dryRun = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--dry-run=false") {
      dryRun = false;
    } else if (arg === "--dry-run=true") {
      dryRun = true;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  const quantId = positional[0];
  if (!quantId) {
    console.error(
      "Usage: pnpm create-vault <quant-id> [--dry-run=false]"
    );
    process.exit(1);
  }

  return { quantId, dryRun };
}

async function main(): Promise<void> {
  const { quantId, dryRun } = parseArgs(process.argv.slice(2));

  // 1. Look up Quant in DB
  const quant = await prisma.quant.findUnique({
    where: { id: quantId },
    include: { user: true },
  });
  if (!quant) {
    console.error(`Quant not found: ${quantId}`);
    process.exit(1);
  }

  const username = quant.user.twitterUsername ?? quantId;

  // 2. Check if vault already exists
  const existing = await prisma.vault.findUnique({
    where: { quantId: quant.id },
  });
  if (existing) {
    console.error(`Vault already exists for quant ${quantId}: ${existing.statePda}`);
    process.exit(1);
  }

  // 3. Create GLAM vault on-chain
  console.log(`Creating vault for quant @${username}...`);
  const { txSig, statePda } = await createQuantVault(username);
  console.log(`  Vault created: ${statePda}`);
  console.log(`  Tx: ${txSig}`);

  // 4. Enable Jupiter integration
  console.log("Enabling Jupiter integration...");
  const jupTx = await enableJupiterIntegration(new PublicKey(statePda));
  console.log(`  Jupiter enabled: ${jupTx}`);

  // 5. Derive glamVaultPda
  const glamVaultPda = deriveVaultPda(new PublicKey(statePda)).toBase58();
  console.log(`  Vault PDA: ${glamVaultPda}`);

  // 6. Insert Vault row in DB
  const vaultName = `quant-${username}`;
  const vaultSymbol = `Q-${username.slice(0, 6).toUpperCase()}`;

  const vault = await prisma.vault.create({
    data: {
      quantId: quant.id,
      statePda,
      glamVaultPda,
      vaultName,
      vaultSymbol,
      dryRun,
      jupiterEnabled: true,
    },
  });

  console.log(`  DB record created: ${vault.id}`);
  console.log(`\nVault setup complete for @${username}`);
  console.log(`  State PDA: ${statePda}`);
  console.log(`  Vault PDA: ${glamVaultPda}`);
  console.log(`  Dry run: ${dryRun}`);
}

main()
  .catch((error) => {
    console.error("Vault creation failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
