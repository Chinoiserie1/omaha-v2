import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Share, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { QuantProfile } from "../../../../../components/explore/QuantProfile";
import { useQuantDetail } from "../../../../../hooks/queries/use-explore-search";
import { useAuth } from "../../../../../contexts/auth-context";
import { useFollowStatus } from "../../../../../hooks/queries/use-follow-status";
import { useToggleFollow } from "../../../../../hooks/mutations/use-toggle-follow";

export default function QuantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: quant } = useQuantDetail(id);
  const { status } = useAuth();

  const username = quant?.user.twitterUsername ?? "";
  const userId = quant?.userId;

  const { data: followData } = useFollowStatus(userId ?? "");
  const { mutate: toggleFollow, isPending: isFollowPending } = useToggleFollow(
    userId ?? "",
  );

  const isFollowing = followData?.isFollowing ?? false;
  const isAuthenticated = status === "authenticated";

  const handleShare = async () => {
    const url = `https://omaha.sh/quant/${id}`;
    await Share.share({
      message: username
        ? `Check out @${username} on Omaha: ${url}`
        : `Check out this Quant on Omaha: ${url}`,
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: "#F8FAFC",
          headerTitle: "",
          headerLeft: () => (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Pressable
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/(app)/(tabs)/(explore)")
                }
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
              </Pressable>
              {username ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: "#F8FAFC",
                    fontSize: 16,
                    fontWeight: "600",
                    flexShrink: 1,
                    maxWidth: 200,
                    marginRight: 8,
                  }}
                >
                  @{username}
                </Text>
              ) : null}
            </View>
          ),
          headerRight: () => (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 16, marginHorizontal: 8 }}
            >
              {isAuthenticated && userId && (
                <Pressable
                  onPress={() => toggleFollow()}
                  disabled={isFollowPending}
                  hitSlop={8}
                  style={{ opacity: isFollowPending ? 0.5 : 1 }}
                >
                  <Ionicons
                    name={isFollowing ? "star" : "star-outline"}
                    size={22}
                    color={isFollowing ? "#FBBF24" : "#F8FAFC"}
                  />
                </Pressable>
              )}
              <Pressable onPress={handleShare} hitSlop={8}>
                <Ionicons
                  name="share-outline"
                  size={22}
                  color="#F8FAFC"
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <QuantProfile quantId={id} />
    </>
  );
}
