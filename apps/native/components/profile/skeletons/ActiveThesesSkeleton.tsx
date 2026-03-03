import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardContent } from "@/components/ui/card";

function ThesisRowSkeleton() {
  return (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </View>
      <View className="items-end gap-1.5">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
      </View>
    </View>
  );
}

export function ActiveThesesSkeleton() {
  return (
    <Card className="mb-4">
      <CardContent className="gap-1">
        <Skeleton className="mb-2 h-4 w-28 rounded" />
        <ThesisRowSkeleton />
        <View className="h-px bg-border" />
        <ThesisRowSkeleton />
      </CardContent>
    </Card>
  );
}
