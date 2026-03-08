import { useState } from "react";
import { View, Image, TouchableOpacity } from "react-native";
import { Text } from "@/components/ui/text";
import { Card, CardContent } from "@/components/ui/card";
import { Ionicons } from "@expo/vector-icons";
import { TweetEmbed } from "./TweetEmbed";
import type { ExploreSignal } from "@repo/shared";

const IMPACT_TYPE_COLORS: Record<string, string> = {
  new_position: "#10B981",
  reinforcement: "#3B82F6",
  exit: "#EF4444",
  reduction: "#F59E0B",
  rebalance: "#8B5CF6",
};

const CATEGORY_COLORS: Record<string, string> = {
  investment_call: "#818CF8",
  whale_alert: "#F59E0B",
  governance_update: "#10B981",
  macro_analysis: "#3B82F6",
  technical_analysis: "#A78BFA",
  ecosystem_update: "#06B6D4",
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatImpactLabel(type: string): string {
  return type.replace(/_/g, " ").toUpperCase();
}

function formatCategoryLabel(category: string): string {
  return category.replace(/_/g, " ").toUpperCase();
}

interface SignalCardProps {
  signal: ExploreSignal;
}

export function SignalCard({ signal }: SignalCardProps) {
  const { quant, tweet, impact } = signal;
  const [expanded, setExpanded] = useState(false);
  const impactColor = IMPACT_TYPE_COLORS[impact.impactType] ?? "#6B7280";
  const categoryColor = CATEGORY_COLORS[impact.category] ?? "#818CF8";
  // const deltaColor = impact.allocationDelta >= 0 ? "#10B981" : "#EF4444";

  return (
    <Card className="mb-3 gap-0 py-0 border-border/50">
      <CardContent className="gap-3 py-4">
        {/* Header: avatar + name + time | impact badge */}
        <View className="flex-row items-center gap-3">
          {quant.avatarUrl ? (
            <Image
              source={{ uri: quant.avatarUrl }}
              className="h-10 w-10 rounded-full"
            />
          ) : (
            <View className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Ionicons name="person" size={20} color="#64748B" />
            </View>
          )}
          <View className="flex-1">
            <Text className="text-sm font-bold" style={{ color: "#F1F5F9" }}>
              {quant.username ?? "unknown"}
            </Text>
            <Text className="text-xs" style={{ color: "#64748B" }}>
              {formatTimeAgo(tweet.postedAt)}
            </Text>
          </View>
          <View
            className="rounded px-2 py-0.5"
            style={{ backgroundColor: `${impactColor}20` }}
          >
            <Text
              className="text-[10px] font-bold tracking-wide"
              style={{ color: impactColor }}
            >
              {formatImpactLabel(impact.impactType)}
            </Text>
          </View>
        </View>

        {/* Asset + allocation delta line (disabled — allocationDelta is thesis-driven,
           not price movement; may revisit later)
        {impact.allocationDelta !== 0 && (
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold" style={{ color: "#F8FAFC" }}>
              {impact.assets[0]}
            </Text>
            <Text className="text-sm font-semibold" style={{ color: deltaColor }}>
              {impact.allocationDelta > 0 ? "+" : ""}{impact.allocationDelta.toFixed(0)}%
            </Text>
          </View>
        )} */}

        {/* Tweet content: quoted text or embedded tweet */}
        {expanded ? (
          <TweetEmbed tweetId={tweet.tweetId} />
        ) : (
          <View
            className="rounded-r-lg pl-3 py-2.5"
            style={{ borderLeftWidth: 3, borderLeftColor: categoryColor }}
          >
            <View className="mb-1.5 flex-row items-center gap-1.5">
              <Ionicons name="flash" size={12} color={categoryColor} />
              <Text
                className="text-[10px] font-bold tracking-wide"
                style={{ color: categoryColor }}
              >
                {formatCategoryLabel(impact.category)}
              </Text>
            </View>
            <Text
              className="text-sm leading-5 italic"
              style={{ color: "#CBD5E1" }}
              numberOfLines={4}
            >
              &ldquo;{tweet.fullText.replace(/\n+/g, " ")}&rdquo;
            </Text>
          </View>
        )}

        {/* Footer: engagement + View on X */}
        <View className="flex-row items-center">
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Ionicons name="heart-outline" size={14} color="#64748B" />
              <Text className="text-xs" style={{ color: "#64748B" }}>
                {formatNumber(tweet.favoriteCount)}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="chatbubble-outline" size={14} color="#64748B" />
              <Text className="text-xs" style={{ color: "#64748B" }}>
                {formatNumber(tweet.replyCount)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            className="ml-auto rounded-lg bg-indigo-600 px-3 py-1.5"
            onPress={() => setExpanded(!expanded)}
          >
            <Text className="text-xs font-semibold" style={{ color: "#F8FAFC" }}>
              {expanded ? "Collapse" : "View Tweet"}
            </Text>
          </TouchableOpacity>
        </View>
      </CardContent>
    </Card>
  );
}
