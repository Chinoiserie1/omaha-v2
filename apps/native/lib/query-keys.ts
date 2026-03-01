export const queryKeys = {
  onboarding: {
    status: (privyId: string) => ["onboarding", "status", privyId] as const,
  },
  profile: {
    me: () => ["profile", "me"] as const,
  },
  vaults: {
    all: (search?: string) => ["vaults", "list", { search }] as const,
    detail: (id: string) => ["vaults", id] as const,
    investorStatus: (id: string, wallet: string) =>
      ["vaults", id, "investor-status", wallet] as const,
    performance: (id: string, period: string) =>
      ["vaults", id, "performance", period] as const,
    holdings: (id: string) => ["vaults", id, "holdings"] as const,
  },
  username: {
    check: (username: string) => ["username", "check", username] as const,
  },
  wallet: {
    portfolio: (address: string) =>
      ["wallet", "portfolio", address] as const,
  },
  withdrawals: {
    all: () => ["withdrawals"] as const,
    byVault: (vaultId: string) => ["withdrawals", "vault", vaultId] as const,
    detail: (withdrawalId: string) =>
      ["withdrawals", withdrawalId] as const,
  },
};
