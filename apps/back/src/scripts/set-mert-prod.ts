import { prisma } from "@repo/database";

async function main() {
  const kol = await prisma.kol.findUnique({ where: { username: "mert" } });
  if (!kol) throw new Error("KOL mert not found");

  const vault = await prisma.kolVault.update({
    where: { kolId: kol.id },
    data: { dryRun: false },
  });
  console.log(`Set mert vault ${vault.id} dryRun=false`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
