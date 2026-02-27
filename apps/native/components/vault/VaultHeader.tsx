import { View } from "react-native";
import { memo } from "react";
import { VaultProfilePicture } from "./VaultProfilePicture";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";

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
      <Text className="mt-4 text-center text-2xl font-bold">{name}</Text>
      <Text className="mt-1 text-sm text-muted-foreground">
        @{kolUsername}
      </Text>
      <Badge
        variant="secondary"
        className={`mt-3 ${isActive ? "bg-emerald-900/40" : "bg-red-900/40"}`}
      >
        <Text
          className={`text-xs font-semibold ${isActive ? "text-emerald-400" : "text-red-400"}`}
        >
          {isActive ? "Active" : "Inactive"}
        </Text>
      </Badge>
    </View>
  );
});
