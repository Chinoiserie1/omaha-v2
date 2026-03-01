import { prisma } from "@repo/database";

export async function findAllActiveVaults() {
  return prisma.kolVault.findMany({
    where: { isActive: true },
    include: { kol: true },
  });
}

export async function findActiveVaultsPaginated({
  skip,
  take,
  search,
}: {
  skip: number;
  take: number;
  search?: string;
}) {
  const where = {
    isActive: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            {
              kolUsername: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
  const [vaults, total] = await Promise.all([
    prisma.kolVault.findMany({
      where,
      include: { kol: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.kolVault.count({ where }),
  ]);
  return { vaults, total };
}

export async function findVaultById(id: string) {
  return prisma.kolVault.findUnique({
    where: { id },
    include: { kol: true },
  });
}

export async function findVaultByKolId(kolId: string) {
  return prisma.kolVault.findUnique({
    where: { kolId },
    include: { kol: true },
  });
}

export async function upsertVault(data: {
  kolId: string;
  kolUsername: string;
  name: string;
  description: string;
  statePda: string;
  glamVaultPda?: string;
  vaultName: string;
  vaultSymbol: string;
}) {
  return prisma.kolVault.upsert({
    where: { kolId: data.kolId },
    update: {
      kolUsername: data.kolUsername,
      name: data.name,
      description: data.description,
      glamVaultPda: data.glamVaultPda ?? null,
    },
    create: data,
  });
}
