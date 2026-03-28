import { View, Text, Pressable } from "react-native";
import { useCallback } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { RebalanceWithSnapshot } from "../../hooks/queries/use-vault-rebalances";
import { formatDate } from "../../lib/format";
import { RebalanceBadge } from "./RebalanceBadge";
import { RebalanceTweetCard } from "./RebalanceTweetCard";

const EXPAND_CONFIG = { duration: 400, easing: Easing.out(Easing.cubic) };
const COLLAPSE_CONFIG = { duration: 250, easing: Easing.out(Easing.cubic) };
const CHANGE_ROW_HEIGHT = 28;

interface RebalanceItemProps {
  event: RebalanceWithSnapshot;
  isFirst: boolean;
  isLast: boolean;
}

export function RebalanceItem({ event, isFirst, isLast }: RebalanceItemProps) {
  const { snapshot } = event;
  const open = useSharedValue(0);

  const hasChanges = snapshot.changes.length > 0;

  const toggle = useCallback(() => {
    if (!hasChanges) return;
    const expanding = open.value === 0;
    open.value = withTiming(
      expanding ? 1 : 0,
      expanding ? EXPAND_CONFIG : COLLAPSE_CONFIG,
    );
  }, [open, hasChanges]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${open.value * 180}deg` }],
  }));

  const changesStyle = useAnimatedStyle(() => ({
    maxHeight: open.value * (snapshot.changes.length * CHANGE_ROW_HEIGHT + 16),
    opacity: open.value,
    overflow: "hidden" as const,
  }));

  const dotColor = isFirst ? "#3B82F6" : "#475569";
  const dotBorderColor = isFirst ? "#3B82F6" : "#334155";

  return (
    <View className="flex-row">
      <View className="items-center" style={{ width: 24 }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: dotBorderColor,
            backgroundColor: isFirst ? dotColor : "transparent",
            marginTop: 4,
          }}
        />
        {!isLast && (
          <View
            style={{
              width: 2,
              flex: 1,
              backgroundColor: "#1E293B",
              marginVertical: 2,
            }}
          />
        )}
      </View>

      <View className="flex-1 ml-3" style={{ marginBottom: isLast ? 0 : 16 }}>
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-xs text-muted-foreground">
            {formatDate(event.startedAt)}
          </Text>
          <RebalanceBadge
            label={event.status}
            variant={event.status === "COMPLETED" ? "blue" : "gray"}
          />
          {event.totalSwaps > 0 && (
            <Text className="text-xs text-muted-foreground">
              {event.totalSwaps} swaps
            </Text>
          )}
        </View>

        {snapshot.topTweet && <RebalanceTweetCard item={snapshot.topTweet} />}

        {hasChanges && (
          <Pressable
            onPress={toggle}
            hitSlop={8}
            className="items-center py-2"
          >
            <Animated.View style={chevronStyle}>
              <Ionicons
                name="chevron-down"
                size={18}
                color="#64748B"
              />
            </Animated.View>
          </Pressable>
        )}

        {hasChanges && (
          <Animated.View style={changesStyle}>
            <View className="pt-1">
              {snapshot.changes.map((change, i) => (
                <Text
                  key={i}
                  className="text-xs text-muted-foreground leading-5"
                  style={{ marginBottom: i < snapshot.changes.length - 1 ? 4 : 0 }}
                >
                  {"—  "}
                  {change}
                </Text>
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
