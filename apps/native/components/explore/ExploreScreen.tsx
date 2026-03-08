import { useState, useCallback } from "react";
import { View, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { AssetSearchBar } from "./AssetSearchBar";
import { AssetSuggestionList } from "./AssetSuggestionList";
import { SignalList } from "./SignalList";
import { TrendingContent } from "./TrendingContent";
import { useAssetAutocomplete } from "../../hooks/queries/use-explore-search";
import { useDebouncedValue } from "../../hooks/use-debounced-value";

export function ExploreScreen() {
  const [inputText, setInputText] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const debouncedInput = useDebouncedValue(inputText, 300);
  const { data: suggestions } = useAssetAutocomplete(
    selectedAsset ? "" : debouncedInput,
  );

  const handleSelect = useCallback((symbol: string) => {
    setSelectedAsset(symbol);
    setInputText("");
    Keyboard.dismiss();
  }, []);

  const handleClear = useCallback(() => {
    setSelectedAsset(null);
    setInputText("");
  }, []);

  const showSuggestions =
    !selectedAsset && inputText.length > 0 && (suggestions?.length ?? 0) > 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-5 pt-5 pb-3">
        <Text className="mb-3 text-2xl font-bold text-foreground">
          Explore
        </Text>
        <View className="z-50">
          <AssetSearchBar
            inputText={inputText}
            selectedAsset={selectedAsset}
            onChangeText={setInputText}
            onClear={handleClear}
          />
          {showSuggestions && (
            <AssetSuggestionList
              suggestions={suggestions!}
              onSelect={handleSelect}
            />
          )}
        </View>
      </View>

      {selectedAsset ? (
        <SignalList asset={selectedAsset} />
      ) : (
        <TrendingContent onSelectAsset={handleSelect} />
      )}
    </SafeAreaView>
  );
}
