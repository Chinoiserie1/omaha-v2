import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DiscoverHeader } from "../../../../components/home/DiscoverHeader";
import { VaultSearchBar } from "../../../../components/home/VaultSearchBar";
import { VaultList } from "../../../../components/home/VaultList";
import { useDebouncedValue } from "../../../../hooks/use-debounced-value";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-5 pt-5 pb-3">
        <DiscoverHeader />
        <VaultSearchBar value={searchQuery} onChangeText={setSearchQuery} />
      </View>
      <VaultList search={debouncedSearch} />
    </SafeAreaView>
  );
}
