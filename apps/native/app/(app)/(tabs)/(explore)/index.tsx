import { useState, useCallback, useRef } from "react";
import { Keyboard } from "react-native";
import { Stack } from "expo-router";
import type { SearchBarCommands } from "react-native-screens";
import { ExploreContent } from "../../../../components/explore/ExploreContent";
import { useDebouncedValue } from "../../../../hooks/use-debounced-value";
import { useAssetAutocomplete } from "../../../../hooks/queries/use-explore-search";

export default function ExploreRoute() {
  const searchBarRef = useRef<SearchBarCommands>(null) as React.RefObject<SearchBarCommands>;
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
    setInputText(symbol);
    searchBarRef.current?.setText(symbol);
    Keyboard.dismiss();
  }, []);

  const handleClear = useCallback(() => {
    setSelectedAsset(null);
    setInputText("");
    searchBarRef.current?.setText("");
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
            ref: searchBarRef,
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
