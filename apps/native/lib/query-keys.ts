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
    rebalances: (id: string) => ["vaults", id, "rebalances"] as const,
    favoriteStatus: (id: string) => ["vaults", id, "favorite"] as const,
  },
  username: {
    check: (username: string) => ["username", "check", username] as const,
  },
  wallet: {
    portfolio: (address: string) =>
      ["wallet", "portfolio", address] as const,
    portfolioChart: (address: string, period: string) =>
      ["wallet", "portfolio", address, "chart", period] as const,
    activeTheses: (address: string) =>
      ["wallet", "portfolio", address, "active-theses"] as const,
  },
  explore: {
    search: (asset: string) => ["explore", "search", asset] as const,
    assets: (q: string) => ["explore", "assets", q] as const,
  },
  chat: {
    history: () => ["chat", "history"] as const,
  },
  withdrawals: {
    all: () => ["withdrawals"] as const,
    byVault: (vaultId: string) => ["withdrawals", "vault", vaultId] as const,
    detail: (withdrawalId: string) =>
      ["withdrawals", withdrawalId] as const,
  },
};
