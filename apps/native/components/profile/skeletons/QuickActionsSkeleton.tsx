import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

export function QuickActionsSkeleton() {
  return (
    <View className="mb-6 flex-row gap-3">
      <Skeleton className="h-10 flex-1 rounded-lg" />
      <Skeleton className="h-10 flex-1 rounded-lg" />
    </View>
  );
}
