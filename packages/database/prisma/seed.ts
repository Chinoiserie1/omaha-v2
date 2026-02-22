import { prisma } from "../src/client.js";

async function main() {
  console.info("Seeding database...");

  const user = await prisma.user.upsert({
    where: { privyId: "demo-privy-id" },
    update: {},
    create: {
      privyId: "demo-privy-id",
      email: "demo@example.com",
      name: "Demo User",
      username: "demo",
      onboardingCompleted: true,
    },
  });

  console.info("Created demo user:", user);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
