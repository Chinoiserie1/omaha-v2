import { useState } from "react";
import { Stack } from "expo-router";
import { VaultList } from "../../../../components/home/VaultList";
import { useDebouncedValue } from "../../../../hooks/use-debounced-value";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Explore",
          headerLargeTitleEnabled: true,
          headerTransparent: true,
          headerLargeTitleShadowVisible: false,
          headerShadowVisible: false,
          headerTintColor: "#F8FAFC",
          headerLargeTitleStyle: { color: "#F8FAFC" },
          headerSearchBarOptions: {
            placeholder: "Search vaults...",
            onChangeText: (e) => setSearchQuery(e.nativeEvent.text),
            autoCapitalize: "none",
            hideWhenScrolling: false,
          },
        }}
      />
      <VaultList search={debouncedSearch} />
    </>
  );
}
