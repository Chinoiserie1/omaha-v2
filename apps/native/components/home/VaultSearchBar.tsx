import { View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface VaultSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function VaultSearchBar({ value, onChangeText }: VaultSearchBarProps) {
  return (
    <View className="mt-4 flex-row items-center rounded-xl bg-secondary px-3 py-1.5">
      <Ionicons name="search" size={18} color="#94A3B8" />
      <TextInput
        className="ml-3 flex-1 text-base text-foreground"
        placeholder="Search vaults..."
        placeholderTextColor="#64748B"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
