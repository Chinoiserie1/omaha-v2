import { useState, useCallback } from "react";
import { Keyboard } from "react-native";
import { Stack } from "expo-router";
import { ExploreContent } from "../../../../components/explore/ExploreContent";
import { useDebouncedValue } from "../../../../hooks/use-debounced-value";
import { useAssetAutocomplete } from "../../../../hooks/queries/use-explore-search";

export default function ExploreRoute() {
  const [inputText, setInputText] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const debouncedInput = useDebouncedValue(inputText, 300);
  const { data: suggestions } = useAssetAutocomplete(
    selectedAsset ? "" : debouncedInput,
  );

  const showSuggestions =
    !selectedAsset && inputText.length > 0 && (suggestions?.length ?? 0) > 0;

  const handleSelect = useCallback((symbol: string) => {
    setSelectedAsset(symbol);
    setInputText("");
    Keyboard.dismiss();
  }, []);

  const handleClear = useCallback(() => {
    setSelectedAsset(null);
    setInputText("");
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Explore",
          // headerLargeTitleEnabled: true,
          headerTransparent: true,
          headerLargeTitleShadowVisible: false,
          headerShadowVisible: false,
          headerTintColor: "#F8FAFC",
          headerLargeTitleStyle: { color: "#F8FAFC" },
          headerSearchBarOptions: {
            placeholder: "Search assets (SOL, BTC, ETH...)",
            onChangeText: (e) => {
              const text = e.nativeEvent.text;
              setInputText(text);
              if (text.length === 0 && selectedAsset) {
                setSelectedAsset(null);
              }
            },
            onCancelButtonPress: handleClear,
            autoCapitalize: "characters",
            hideWhenScrolling: false,
            placement: "integrated",
          },
        }}
      />
      <ExploreContent
        suggestions={showSuggestions ? suggestions! : []}
        selectedAsset={selectedAsset}
        onSelectAsset={handleSelect}
      />
    </>
  );
}
