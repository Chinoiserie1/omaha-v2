import { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { PortfolioItem } from "@repo/shared";

interface ExpandableTokenListProps {
  items: PortfolioItem[];
}

const ROW_HEIGHT = 44;
const EXPAND_CONFIG = { duration: 400, easing: Easing.out(Easing.cubic) };
const COLLAPSE_CONFIG = { duration: 250, easing: Easing.out(Easing.cubic) };

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}k`;
  }
  return `$${value.toFixed(2)}`;
}

function getItemName(item: PortfolioItem): string {
  return item.name;
}

export function ExpandableTokenList({ items }: ExpandableTokenListProps) {
  const open = useSharedValue(0);

  const toggleExpanded = useCallback(() => {
    const expanding = open.value === 0;
    open.value = withTiming(expanding ? 1 : 0, expanding ? EXPAND_CONFIG : COLLAPSE_CONFIG);
  }, [open]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${open.value * 90}deg` }],
  }));

  const listStyle = useAnimatedStyle(() => ({
    maxHeight: open.value * (items.length * ROW_HEIGHT + 4),
    opacity: open.value,
    overflow: "hidden" as const,
  }));

  if (items.length === 0) return null;

  return (
    <View className="border-t border-border pt-3">
      <Pressable
        onPress={toggleExpanded}
        className="flex-row items-center justify-between py-2"
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-xs uppercase tracking-wider text-muted-foreground">
            Tokens
          </Text>
          <View className="bg-secondary rounded-full px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-muted-foreground">
              {items.length}
            </Text>
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
        </Animated.View>
      </Pressable>

      <Animated.View style={listStyle}>
        {items.map((item, index) => (
          <View
            key={item.type === "vault" ? item.vaultId : item.mint}
            className={`flex-row items-center justify-between py-2.5 ${
              index < items.length - 1
                ? "border-b border-border/50"
                : ""
            }`}
          >
            <View className="flex-row items-center gap-2 flex-1">
              <View
                className={`w-6 h-6 rounded-full items-center justify-center ${
                  item.type === "vault"
                    ? "bg-emerald-500/20"
                    : "bg-secondary"
                }`}
              >
                <Text className="text-[10px] font-bold text-muted-foreground">
                  {item.type === "vault" ? "V" : item.symbol.slice(0, 2)}
                </Text>
              </View>
              <Text
                className="text-sm text-foreground"
                numberOfLines={1}
              >
                {getItemName(item)}
              </Text>
            </View>
            <Text className="text-sm font-semibold text-foreground">
              {formatUsd(item.valueUsd)}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
