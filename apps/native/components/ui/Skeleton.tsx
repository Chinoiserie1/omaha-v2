import { View } from "react-native";
import { memo, useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  borderRadius?: number;
  className?: string;
}

export const Skeleton = memo(function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = 8,
  className = "bg-zinc-800",
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius }, animatedStyle]}
      className={className}
    />
  );
});

interface ChartSkeletonProps {
  width?: number;
  height?: number;
  className?: string;
}

export const ChartSkeleton = memo(function ChartSkeleton({
  width,
  height = 200,
  className = "",
}: ChartSkeletonProps) {
  return (
    <View
      className={className}
      style={[{ width: width ?? "100%", height, justifyContent: "flex-end" }]}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 8 }}>
        <Skeleton width="85%" height={2} borderRadius={1} className="bg-zinc-700 mb-4" />
        <Skeleton width="60%" height={2} borderRadius={1} className="bg-zinc-700 mb-4" />
        <Skeleton width="75%" height={2} borderRadius={1} className="bg-zinc-700 mb-4" />
        <Skeleton width="50%" height={2} borderRadius={1} className="bg-zinc-700" />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 8,
          paddingTop: 12,
        }}
      >
        <Skeleton width={28} height={10} borderRadius={4} className="bg-zinc-700" />
        <Skeleton width={28} height={10} borderRadius={4} className="bg-zinc-700" />
        <Skeleton width={28} height={10} borderRadius={4} className="bg-zinc-700" />
        <Skeleton width={28} height={10} borderRadius={4} className="bg-zinc-700" />
      </View>
    </View>
  );
});
