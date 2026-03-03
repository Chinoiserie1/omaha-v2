import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { GlassView } from "@/components/ui/glass";

export function BalanceAreaSkeleton() {
  return (
    <View className="mb-4 gap-4">
      {/* USDC available label */}
      <View className="items-center">
        <Skeleton className="h-4 w-40 rounded" />
      </View>

      {/* Gas gauge bar */}
      <GlassView className="rounded-xl px-4 py-3">
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </View>
          <Skeleton className="h-2 w-full rounded-full" />
          <View className="flex-row items-center justify-between">
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </View>
        </View>
      </GlassView>
    </View>
  );
}

/** @deprecated Use BalanceAreaSkeleton instead */
export const AssetCardsSkeleton = BalanceAreaSkeleton;
