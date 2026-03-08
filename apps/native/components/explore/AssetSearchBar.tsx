import { View, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";

interface AssetSearchBarProps {
  inputText: string;
  selectedAsset: string | null;
  onChangeText: (text: string) => void;
  onClear: () => void;
}

export function AssetSearchBar({
  inputText,
  selectedAsset,
  onChangeText,
  onClear,
}: AssetSearchBarProps) {
  return (
    <View className="flex-row items-center rounded-xl bg-secondary px-3 py-1.5">
      <Ionicons name="search" size={18} color="#94A3B8" />
      {selectedAsset ? (
        <View className="ml-3 flex-1 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-foreground">
            {selectedAsset}
          </Text>
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextInput
            className="ml-3 flex-1 text-base text-foreground"
            placeholder="Search assets (SOL, BTC, ETH...)"
            placeholderTextColor="#64748B"
            value={inputText}
            onChangeText={onChangeText}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {inputText.length > 0 && (
            <TouchableOpacity onPress={onClear} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#64748B" />
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}
