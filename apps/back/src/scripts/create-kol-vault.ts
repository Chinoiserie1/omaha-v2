import { prisma } from "@repo/database";
import { PublicKey } from "@solana/web3.js";
import { createKolVault, enableJupiterIntegration } from "../solana/vault-setup.js";
import { deriveVaultPda } from "../solana/config.js";

function parseArgs(args: string[]): {
  username: string;
  name: string | undefined;
  description: string | undefined;
  dryRun: boolean;
} {
  const positional: string[] = [];
  let name: string | undefined;
  let description: string | undefined;
  let dryRun = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--name" && i + 1 < args.length) {
      name = args[++i]!;
    } else if (arg.startsWith("--name=")) {
      name = arg.slice("--name=".length);
    } else if (arg === "--description" && i + 1 < args.length) {
      description = args[++i]!;
    } else if (arg.startsWith("--description=")) {
      description = arg.slice("--description=".length);
    } else if (arg === "--dry-run=false") {
      dryRun = false;
    } else if (arg === "--dry-run=true") {
      dryRun = true;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  const username = positional[0];
  if (!username) {
    console.error(
      'Usage: pnpm create-vault <kol-username> [--name "Vault Name"] [--description "..."] [--dry-run=false]'
    );
    process.exit(1);
  }

  return { username, name, description, dryRun };
}

async function main(): Promise<void> {
  const { username, name, description, dryRun } = parseArgs(process.argv.slice(2));

  // 1. Look up KOL in DB
  const kol = await prisma.kol.findUnique({ where: { username } });
  if (!kol) {
    console.error(`KOL not found: ${username}`);
    process.exit(1);
  }

  // 2. Check if vault already exists
  const existing = await prisma.kolVault.findUnique({
    where: { kolId: kol.id },
  });
  if (existing) {
    console.error(`Vault already exists for ${username}: ${existing.statePda}`);
    process.exit(1);
  }

  // 3. Create GLAM vault on-chain
  console.log(`Creating vault for @${username}...`);
  const { txSig, statePda } = await createKolVault(username);
  console.log(`  Vault created: ${statePda}`);
  console.log(`  Tx: ${txSig}`);

  // 4. Enable Jupiter integration
  console.log("Enabling Jupiter integration...");
  const jupTx = await enableJupiterIntegration(new PublicKey(statePda));
  console.log(`  Jupiter enabled: ${jupTx}`);

  // 5. Derive glamVaultPda
  const glamVaultPda = deriveVaultPda(new PublicKey(statePda)).toBase58();
  console.log(`  Vault PDA: ${glamVaultPda}`);

  // 6. Insert KolVault row in DB
  const vaultName = `kol-${username}`;
  const vaultSymbol = `KOL-${username.slice(0, 6).toUpperCase()}`;

  const kolVault = await prisma.kolVault.create({
    data: {
      kolId: kol.id,
      kolUsername: username,
      name: name ?? `${username} Vault`,
      description: description ?? "",
      statePda,
      glamVaultPda,
      vaultName,
      vaultSymbol,
      dryRun,
      jupiterEnabled: true,
    },
  });

  console.log(`  DB record created: ${kolVault.id}`);
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
