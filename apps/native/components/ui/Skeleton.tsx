import { cn } from "@/lib/utils";
import { memo } from "react";
import { View } from "react-native";

function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <View
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

interface ChartSkeletonProps {
  width?: number;
  height?: number;
  className?: string;
}

const ChartSkeleton = memo(function ChartSkeleton({
  width,
  height = 200,
  className = "",
}: ChartSkeletonProps) {
  return (
    <View
      className={className}
      style={[
        { width: width ?? "100%", height, justifyContent: "flex-end" },
      ]}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 8,
        }}
      >
        <Skeleton className="bg-muted mb-4 h-[2px] w-[85%]" />
        <Skeleton className="bg-muted mb-4 h-[2px] w-[60%]" />
        <Skeleton className="bg-muted mb-4 h-[2px] w-[75%]" />
        <Skeleton className="bg-muted h-[2px] w-[50%]" />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 8,
          paddingTop: 12,
        }}
      >
        <Skeleton className="bg-muted h-[10px] w-[28px] rounded" />
        <Skeleton className="bg-muted h-[10px] w-[28px] rounded" />
        <Skeleton className="bg-muted h-[10px] w-[28px] rounded" />
        <Skeleton className="bg-muted h-[10px] w-[28px] rounded" />
      </View>
    </View>
  );
});

export { ChartSkeleton, Skeleton };
