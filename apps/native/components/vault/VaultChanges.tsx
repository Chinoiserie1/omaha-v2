import { View, Text, Pressable } from "react-native";
import { memo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { RebalanceWithSnapshot } from "../../hooks/queries/use-vault-rebalances";
import { RebalanceItem } from "./RebalanceItem";

const INITIAL_COUNT = 3;
const INCREMENT = 3;

interface VaultChangesProps {
  rebalances: RebalanceWithSnapshot[];
  onViewAll?: () => void;
}

export const VaultChanges = memo(function VaultChanges({
  rebalances,
  onViewAll,
}: VaultChangesProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  if (rebalances.length === 0) return null;

  const visible = rebalances.slice(0, visibleCount);
  const hasMore = visibleCount < rebalances.length;

  return (
    <View className="mx-5">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Strategy Updates
        </Text>
        {onViewAll && (
          <Pressable onPress={onViewAll} hitSlop={8} className="flex-row items-center gap-1">
            <Text className="text-xs font-medium" style={{ color: "#3B82F6" }}>
              View All
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#3B82F6" />
          </Pressable>
        )}
      </View>

      {visible.map((event, i) => (
        <RebalanceItem
          key={event.id}
          event={event}
          isFirst={i === 0}
          isLast={i === visible.length - 1 && !hasMore}
        />
      ))}

      {hasMore && (
        <Pressable
          onPress={() => setVisibleCount((c) => c + INCREMENT)}
          className="items-center py-3"
        >
          <Text className="text-xs font-medium" style={{ color: "#3B82F6" }}>
            Show More
          </Text>
        </Pressable>
      )}
    </View>
  );
});
