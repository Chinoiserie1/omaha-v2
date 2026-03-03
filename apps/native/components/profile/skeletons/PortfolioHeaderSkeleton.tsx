import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

export function PortfolioHeaderSkeleton() {
  return (
    <View className="mb-6 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <View className="gap-1.5">
          <Skeleton className="h-5 w-28 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </View>
      </View>
      <Skeleton className="h-6 w-6 rounded" />
    </View>
  );
}
