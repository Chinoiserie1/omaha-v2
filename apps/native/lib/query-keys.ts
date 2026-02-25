export const queryKeys = {
  onboarding: {
    status: (privyId: string) => ["onboarding", "status", privyId] as const,
  },
  profile: {
    me: () => ["profile", "me"] as const,
  },
  vaults: {
    all: () => ["vaults"] as const,
    detail: (id: string) => ["vaults", id] as const,
    investorStatus: (id: string, wallet: string) =>
      ["vaults", id, "investor-status", wallet] as const,
    performance: (id: string, period: string) =>
      ["vaults", id, "performance", period] as const,
  },
  username: {
    check: (username: string) => ["username", "check", username] as const,
  },
  wallet: {
    portfolio: (address: string) =>
      ["wallet", "portfolio", address] as const,
  },
};
