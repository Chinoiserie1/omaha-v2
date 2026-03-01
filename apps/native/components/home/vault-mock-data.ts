/**
 * Mock data for vault fields not yet available from the API.
 * Replace with real API data when backend adds these fields.
 */

interface VaultMockData {
  category: string;
  followersCount: number;
}

const MOCK_DATA: Record<string, VaultMockData> = {};

const CATEGORIES = [
  "DeFi Alpha",
  "Meme Hunter",
  "Blue Chip",
  "Degen Plays",
  "AI Narrative",
  "L2 Focus",
];

const FOLLOWERS_RANGE = { min: 50, max: 5000 };

function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

export function getVaultMockData(vaultId: string): VaultMockData {
  const cached = MOCK_DATA[vaultId];
  if (cached) return cached;

  const rand = seededRandom(vaultId);
  const rand3 = seededRandom(vaultId + "followers");

  const data: VaultMockData = {
    category: CATEGORIES[Math.floor(rand * CATEGORIES.length)] ?? "DeFi Alpha",
    followersCount: Math.round(
      FOLLOWERS_RANGE.min +
        rand3 * (FOLLOWERS_RANGE.max - FOLLOWERS_RANGE.min),
    ),
  };

  MOCK_DATA[vaultId] = data;
  return data;
}
