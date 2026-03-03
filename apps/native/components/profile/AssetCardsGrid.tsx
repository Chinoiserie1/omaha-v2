import { View } from "react-native";
import type { PortfolioItem } from "@repo/shared";
import { AssetCard } from "./AssetCard";
import { AssetCardsSkeleton } from "./skeletons";

interface AssetCardsGridProps {
  items: PortfolioItem[];
  isLoading?: boolean;
}

interface DefaultAsset {
  symbol: string;
  name: string;
}

const DEFAULT_ASSETS: DefaultAsset[] = [
  { symbol: "SOL", name: "Solana" },
  { symbol: "USDC", name: "USD Coin" },
];

function findToken(
  items: PortfolioItem[],
  symbol: string,
): Extract<PortfolioItem, { type: "token" }> | undefined {
  return items.find(
    (item): item is Extract<PortfolioItem, { type: "token" }> =>
      item.type === "token" && item.symbol.toUpperCase() === symbol,
  );
}

export function AssetCardsGrid({ items, isLoading = false }: AssetCardsGridProps) {
  if (isLoading) {
    return <AssetCardsSkeleton />;
  }

  return (
    <View className="mb-4 flex-row flex-wrap gap-3">
      {DEFAULT_ASSETS.map((asset) => {
        const token = findToken(items, asset.symbol);
        return (
          <View key={asset.symbol} className="w-[48%]">
            <AssetCard
              symbol={asset.symbol}
              name={asset.name}
              amount={token?.amount ?? 0}
              valueUsd={token?.valueUsd ?? 0}
            />
          </View>
        );
      })}
    </View>
  );
}
