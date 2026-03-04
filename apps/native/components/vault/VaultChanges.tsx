import { View, Text, Pressable, Linking } from "react-native";
import { memo, useCallback } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { RebalanceWithSnapshot } from "../../hooks/queries/use-vault-rebalances";
import { formatNumber, formatDate, impactLabel } from "../../lib/format";

const EXPAND_CONFIG = { duration: 400, easing: Easing.out(Easing.cubic) };
const COLLAPSE_CONFIG = { duration: 250, easing: Easing.out(Easing.cubic) };
const CHANGE_ROW_HEIGHT = 28;

interface VaultChangesProps {
  rebalances: RebalanceWithSnapshot[];
}

function Badge({
  label,
  variant,
}: {
  label: string;
  variant: "blue" | "gray" | "violet";
}) {
  const colors = {
    blue: { bg: "rgba(59,130,246,0.15)", text: "#3B82F6" },
    gray: { bg: "rgba(100,116,139,0.15)", text: "#94A3B8" },
    violet: { bg: "rgba(139,92,246,0.15)", text: "#A78BFA" },
  } as const;
  const { bg, text } = colors[variant];

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: text, fontSize: 11, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

interface TopTweet {
  id: string;
  assets: string[];
  impactType: string;
  conviction: string;
  sentiment: string;
  significanceScore: number;
  tweet: {
    tweetId: string;
    fullText: string;
    postedAt: string;
    favoriteCount: number;
    retweetCount: number;
    replyCount: number;
    bookmarkCount: number;
    viewsCount: number;
  };
}

function TweetCard({ item }: { item: TopTweet }) {
  const { tweet } = item;

  const openTweet = () => {
    Linking.openURL(`https://x.com/i/status/${tweet.tweetId}`);
  };

  return (
    <View className="bg-card border border-border rounded-xl p-3">
      {/* Badges */}
      <View className="flex-row flex-wrap gap-1.5 mb-2">
        <Badge
          label={`Score: ${item.significanceScore.toFixed(1)}`}
          variant="blue"
        />
        <Badge label={impactLabel(item.impactType)} variant="gray" />
        {item.assets.map((asset) => (
          <Badge key={asset} label={asset} variant="violet" />
        ))}
      </View>

      {/* Tweet text */}
      <Text
        className="text-sm text-foreground leading-5 mb-2"
        numberOfLines={3}
      >
        {tweet.fullText}
      </Text>

      {/* Conviction + Sentiment */}
      <View className="flex-row gap-3 mb-2">
        <Text className="text-xs text-muted-foreground">
          Conviction:{" "}
          <Text className="font-medium text-foreground">
            {item.conviction}
          </Text>
        </Text>
        <Text className="text-xs text-muted-foreground">
          Sentiment:{" "}
          <Text className="font-medium text-foreground">
            {item.sentiment}
          </Text>
        </Text>
      </View>

      {/* Engagement stats + link */}
      <View className="flex-row flex-wrap items-center gap-3">
        <Text className="text-xs text-muted-foreground">
          {formatNumber(tweet.favoriteCount)} likes
        </Text>
        <Text className="text-xs text-muted-foreground">
          {formatNumber(tweet.retweetCount)} RT
        </Text>
        <Text className="text-xs text-muted-foreground">
          {formatNumber(tweet.viewsCount)} views
        </Text>
        <Text className="text-xs text-muted-foreground">
          {formatDate(tweet.postedAt)}
        </Text>
        <Pressable onPress={openTweet} hitSlop={8}>
          <Text className="text-xs font-medium" style={{ color: "#3B82F6" }}>
            View on X
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RebalanceItem({
  event,
  isFirst,
  isLast,
}: {
  event: RebalanceWithSnapshot;
  isFirst: boolean;
  isLast: boolean;
}) {
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
      {/* Timeline column */}
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

      {/* Content column */}
      <View className="flex-1 ml-3" style={{ marginBottom: isLast ? 0 : 16 }}>
        {/* Header: date + status + swaps */}
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-xs text-muted-foreground">
            {formatDate(event.startedAt)}
          </Text>
          <Badge
            label={event.status}
            variant={event.status === "COMPLETED" ? "blue" : "gray"}
          />
          {event.totalSwaps > 0 && (
            <Text className="text-xs text-muted-foreground">
              {event.totalSwaps} swaps
            </Text>
          )}
        </View>

        {/* Tweet card (always visible) */}
        {snapshot.topTweet && <TweetCard item={snapshot.topTweet} />}

        {/* Chevron toggle */}
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

        {/* Expandable changes list */}
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

export const VaultChanges = memo(function VaultChanges({
  rebalances,
}: VaultChangesProps) {
  if (rebalances.length === 0) return null;

  return (
    <View className="mx-5">
      <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Strategy Updates
      </Text>

      {rebalances.map((event, i) => (
        <RebalanceItem
          key={event.id}
          event={event}
          isFirst={i === 0}
          isLast={i === rebalances.length - 1}
        />
      ))}
    </View>
  );
});
