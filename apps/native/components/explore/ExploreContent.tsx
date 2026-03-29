import { View } from "react-native";
import { AssetSuggestionList } from "./AssetSuggestionList";
import { SignalList } from "./SignalList";
import { TrendingContent } from "./TrendingContent";
import type { AssetSuggestion } from "@repo/shared";

interface ExploreContentProps {
  suggestions: AssetSuggestion[];
  selectedAsset: string | null;
  onSelectAsset: (symbol: string) => void;
}

export function ExploreContent({
  suggestions,
  selectedAsset,
  onSelectAsset,
}: ExploreContentProps) {
  if (suggestions.length > 0) {
    return (
      <View className="flex-1">
        <AssetSuggestionList
          suggestions={suggestions}
          onSelect={onSelectAsset}
        />
      </View>
    );
  }

  if (selectedAsset) {
    return <SignalList asset={selectedAsset} />;
  }

  return <TrendingContent onSelectAsset={onSelectAsset} />;
}
