import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import type { TrendingAsset } from "@repo/shared";

const CATEGORY_COLORS: Record<string, string> = {
  crypto: "#8B5CF6",
  stock: "#3B82F6",
  index: "#F59E0B",
  commodity: "#EF4444",
  fixed_income: "#10B981",
};

interface TrendingAssetRowProps {
  asset: TrendingAsset;
  onPress: (symbol: string) => void;
}

export function TrendingAssetRow({ asset, onPress }: TrendingAssetRowProps) {
  const dotColor = CATEGORY_COLORS[asset.category] ?? "#6B7280";

  return (
    <Pressable
      onPress={() => onPress(asset.symbol)}
      className="flex-row items-center px-5 py-3 active:opacity-70"
    >
      <View
        className="mr-3 h-3 w-3 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground">
          {asset.symbol}
          <Text className="font-normal text-muted-foreground">
            {"  "}
            {asset.name}
          </Text>
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-medium text-foreground">
          {asset.signalCount} signal{asset.signalCount !== 1 ? "s" : ""}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {asset.quantCount} quant{asset.quantCount !== 1 ? "s" : ""}
        </Text>
      </View>
    </Pressable>
  );
}
