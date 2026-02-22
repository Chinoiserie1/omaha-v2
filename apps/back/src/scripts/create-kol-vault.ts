import { prisma } from "@repo/database";
import { PublicKey } from "@solana/web3.js";
import { createKolVault, enableJupiterIntegration } from "../solana/vault-setup.js";

async function main(): Promise<void> {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: pnpm create-vault <kol-username>");
    process.exit(1);
  }

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

  // 5. Insert KolVault row in DB
  const vaultName = `kol-${username}`;
  const vaultSymbol = `KOL-${username.slice(0, 6).toUpperCase()}`;

  const kolVault = await prisma.kolVault.create({
    data: {
      kolId: kol.id,
      statePda,
      vaultName,
      vaultSymbol,
      jupiterEnabled: true,
    },
  });

  console.log(`  DB record created: ${kolVault.id}`);
  console.log(`\nVault setup complete for @${username}`);
  console.log(`  State PDA: ${statePda}`);
}

main()
  .catch((error) => {
    console.error("Vault creation failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
