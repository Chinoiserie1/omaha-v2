import { prisma } from "@repo/database";
import type { KolVault } from "@repo/database";

export async function create(data: {
  kolId: string;
  statePda: string;
  vaultName: string;
  vaultSymbol: string;
}): Promise<KolVault> {
  return prisma.kolVault.create({ data });
}

export async function findByKolId(
  kolId: string
): Promise<KolVault | null> {
  return prisma.kolVault.findUnique({ where: { kolId } });
}

export async function findByStatePda(
  statePda: string
): Promise<KolVault | null> {
  return prisma.kolVault.findUnique({ where: { statePda } });
}

export async function findAllActive(): Promise<KolVault[]> {
  return prisma.kolVault.findMany({ where: { isActive: true } });
}

export async function updateLastRebalanced(id: string): Promise<KolVault> {
  return prisma.kolVault.update({
    where: { id },
    data: { lastRebalancedAt: new Date() },
  });
}

export async function markJupiterEnabled(id: string): Promise<KolVault> {
  return prisma.kolVault.update({
    where: { id },
    data: { jupiterEnabled: true },
  });
}

export async function setDryRun(id: string, dryRun: boolean): Promise<KolVault> {
  return prisma.kolVault.update({ where: { id }, data: { dryRun } });
}

export async function deactivate(id: string): Promise<KolVault> {
  return prisma.kolVault.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function updateVaultProfile(
  kolId: string,
  data: { kolUsername?: string; avatarUrl?: string; name?: string; description?: string }
): Promise<KolVault | null> {
  const vault = await prisma.kolVault.findUnique({ where: { kolId } });
  if (!vault) return null;

  return prisma.kolVault.update({ where: { kolId }, data });
}
