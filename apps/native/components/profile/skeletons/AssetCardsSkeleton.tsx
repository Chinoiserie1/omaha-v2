import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardContent } from "@/components/ui/card";

function AssetCardSkeleton() {
  return (
    <Card className="flex-1">
      <CardContent className="gap-2">
        <View className="flex-row items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-16 rounded" />
        </View>
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-5 w-16 rounded" />
      </CardContent>
    </Card>
  );
}

export function AssetCardsSkeleton() {
  return (
    <View className="mb-4 flex-row flex-wrap gap-3">
      <View className="w-[48%]">
        <AssetCardSkeleton />
      </View>
      <View className="w-[48%]">
        <AssetCardSkeleton />
      </View>
    </View>
  );
}
