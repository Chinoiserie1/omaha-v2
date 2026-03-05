import { prisma } from "@repo/database";
import type { Vault } from "@repo/database";

// ── Vault CRUD ──────────────────────────────────────────────────

export async function create(data: {
  quantId: string;
  statePda: string;
  vaultName: string;
  vaultSymbol: string;
}): Promise<Vault> {
  return prisma.vault.create({ data });
}

export async function findByQuantId(
  quantId: string
): Promise<Vault | null> {
  return prisma.vault.findUnique({ where: { quantId } });
}

export async function findByStatePda(
  statePda: string
): Promise<Vault | null> {
  return prisma.vault.findUnique({ where: { statePda } });
}

export async function findAllActive(): Promise<Vault[]> {
  return prisma.vault.findMany({ where: { isActive: true } });
}

export async function updateLastRebalanced(id: string): Promise<Vault> {
  return prisma.vault.update({
    where: { id },
    data: { lastRebalancedAt: new Date() },
  });
}

export async function markJupiterEnabled(id: string): Promise<Vault> {
  return prisma.vault.update({
    where: { id },
    data: { jupiterEnabled: true },
  });
}

export async function setDryRun(id: string, dryRun: boolean): Promise<Vault> {
  return prisma.vault.update({ where: { id }, data: { dryRun } });
}

export async function deactivate(id: string): Promise<Vault> {
  return prisma.vault.update({
    where: { id },
    data: { isActive: false },
  });
}

// ── Query helpers (with Quant + User relations) ─────────────────

export async function findAllActiveVaults() {
  return prisma.vault.findMany({
    where: { isActive: true },
    include: { quant: { include: { user: true } } },
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
            { vaultName: { contains: search, mode: "insensitive" as const } },
            {
              quant: {
                user: {
                  twitterUsername: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  const [vaults, total] = await Promise.all([
    prisma.vault.findMany({
      where,
      include: { quant: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.vault.count({ where }),
  ]);
  return { vaults, total };
}

export async function findVaultById(id: string) {
  return prisma.vault.findUnique({
    where: { id },
    include: { quant: { include: { user: true } } },
  });
}

export async function findVaultByQuantId(quantId: string) {
  return prisma.vault.findUnique({
    where: { quantId },
    include: { quant: { include: { user: true } } },
  });
}
