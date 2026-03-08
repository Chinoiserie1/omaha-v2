import { View, Image, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useQuantDetail } from "../../hooks/queries/use-explore-search";
import { FollowButton } from "./FollowButton";

interface QuantProfileProps {
  quantId: string;
  onBack: () => void;
}

export function QuantProfile({ quantId, onBack }: QuantProfileProps) {
  const { data: quant, isLoading, isError, refetch } = useQuantDetail(quantId);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !quant) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <Header onBack={onBack} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-center text-base text-muted-foreground">
            Failed to load quant profile
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text className="text-base font-medium text-primary">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const username = quant.user.twitterUsername ?? "Unknown";
  const followerCount = quant.user.twitterFollowerCount ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Header onBack={onBack} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View className="items-center px-5 pb-6 pt-2">
          {quant.user.profileImageUrl ? (
            <Image
              source={{ uri: quant.user.profileImageUrl }}
              className="mb-3 h-20 w-20 rounded-full bg-muted"
            />
          ) : (
            <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Text className="text-2xl font-bold text-muted-foreground">
                {username[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-row items-center">
            <Text className="text-xl font-bold text-foreground">
              @{username}
            </Text>
            <FollowButton userId={quant.userId} />
          </View>
          {quant.user.name && (
            <Text className="mt-1 text-base text-muted-foreground">
              {quant.user.name}
            </Text>
          )}
          <Text className="mt-2 text-sm text-muted-foreground">
            {formatCount(followerCount)} followers
          </Text>
          {quant.user.bio && (
            <Text className="mt-3 text-center text-sm text-muted-foreground">
              {quant.user.bio}
            </Text>
          )}
        </View>

        {/* Recent tweets */}
        <View className="px-5">
          <Text className="mb-3 text-lg font-bold text-foreground">
            Recent Tweets ({quant.tweets.length})
          </Text>
          {quant.tweets.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              No tweets yet
            </Text>
          ) : (
            quant.tweets.map((tweet) => (
              <View
                key={tweet.id}
                className="mb-3 rounded-xl border border-border bg-card p-4"
              >
                <Text className="text-sm leading-5 text-foreground" numberOfLines={6}>
                  {tweet.fullText}
                </Text>
                <View className="mt-2 flex-row items-center gap-4">
                  <Text className="text-xs text-muted-foreground">
                    {new Date(tweet.postedAt).toLocaleDateString()}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {tweet.favoriteCount} likes
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {tweet.retweetCount} RT
                  </Text>
                  {tweet.viewsCount != null && (
                    <Text className="text-xs text-muted-foreground">
                      {formatCount(tweet.viewsCount)} views
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-row items-center px-4 py-3">
      <Pressable onPress={onBack} className="mr-3 p-1">
        <Ionicons name="arrow-back" size={24} color="#94A3B8" />
      </Pressable>
      <Text className="text-lg font-semibold text-foreground">
        Quant Profile
      </Text>
    </View>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
