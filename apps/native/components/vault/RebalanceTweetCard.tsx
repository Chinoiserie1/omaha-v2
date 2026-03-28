import { View, Text, Pressable, Linking } from "react-native";
import { RebalanceBadge } from "./RebalanceBadge";
import { formatNumber, formatDate, impactLabel } from "../../lib/format";

export interface TopTweet {
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

export function RebalanceTweetCard({ item }: { item: TopTweet }) {
  const { tweet } = item;

  const openTweet = () => {
    Linking.openURL(`https://x.com/i/status/${tweet.tweetId}`);
  };

  return (
    <View className="bg-card border border-border rounded-xl p-3">
      <View className="flex-row flex-wrap gap-1.5 mb-2">
        <RebalanceBadge
          label={`Score: ${item.significanceScore.toFixed(1)}`}
          variant="blue"
        />
        <RebalanceBadge label={impactLabel(item.impactType)} variant="gray" />
        {item.assets.map((asset) => (
          <RebalanceBadge key={asset} label={asset} variant="violet" />
        ))}
      </View>

      <Text
        className="text-sm text-foreground leading-5 mb-2"
        numberOfLines={3}
      >
        {tweet.fullText}
      </Text>

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
