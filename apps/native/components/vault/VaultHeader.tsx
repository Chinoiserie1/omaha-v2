import { View, Text } from "react-native";
import { memo } from "react";
import { VaultProfilePicture } from "./VaultProfilePicture";

interface VaultHeaderProps {
  name: string;
  kolUsername: string;
  isActive: boolean;
}

export const VaultHeader = memo(function VaultHeader({
  name,
  kolUsername,
  isActive,
}: VaultHeaderProps) {
  return (
    <View className="items-center px-5 pb-4">
      <VaultProfilePicture name={name} size={80} />
      <Text className="text-2xl font-bold text-white mt-4 text-center">
        {name}
      </Text>
      <Text className="text-sm text-zinc-400 mt-1">@{kolUsername}</Text>
      <View
        className={`mt-3 px-3 py-1 rounded-full ${isActive ? "bg-emerald-900/40" : "bg-red-900/40"}`}
      >
        <Text
          className={`text-xs font-semibold ${isActive ? "text-emerald-400" : "text-red-400"}`}
        >
          {isActive ? "Active" : "Inactive"}
        </Text>
      </View>
    </View>
  );
});
