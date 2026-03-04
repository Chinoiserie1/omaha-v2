import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChartSkeleton } from "@/components/ui/Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function PerformanceChartSkeleton() {
  return (
    <Card className="mb-4">
      <CardContent className="gap-3">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-4 w-14 rounded" />
        </View>

        <ChartSkeleton height={160} />

        <View className="flex-row gap-2">
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 flex-1 rounded-lg" />
        </View>
      </CardContent>
    </Card>
  );
}
