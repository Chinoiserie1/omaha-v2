import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";

export function NetWorthSkeleton() {
  return (
    <View className="mb-6 items-center">
      <Skeleton className="my-1 h-9 w-44 rounded-lg" />
      <Skeleton className="mt-2 h-7 w-28 rounded-full" />
    </View>
  );
}
