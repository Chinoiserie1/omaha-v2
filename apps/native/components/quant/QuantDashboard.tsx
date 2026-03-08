import { View, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useMyProfile } from "@/hooks/queries/use-profile";
import { BecomeQuantScreen } from "@/components/chat/BecomeQuantScreen";

export function QuantDashboard() {
  const router = useRouter();
  const { data: profile, isLoading } = useMyProfile();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!profile?.quantId) {
    return <BecomeQuantScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name="analytics-outline" size={56} color="#71717A" />
        </View>
        <Text style={styles.title}>Your Quant Strategy</Text>
        <Text style={styles.description}>
          Manage your trading strategy, view performance, and track your signals.
        </Text>
      </View>

      {Platform.OS !== "ios" && (
        <View style={styles.chatAction}>
          <Button
            variant="classic"
            className="w-full"
            onPress={() =>
              router.push("/(app)/(tabs)/(quant)/chat" as never)
            }
          >
            <View style={styles.chatButtonContent}>
              <Ionicons name="chatbubble-outline" size={18} color="#FAFAFA" />
              <Text className="text-primary-foreground font-semibold ml-2">
                Manage Portfolio
              </Text>
            </View>
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#71717A",
    fontSize: 15,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconWrapper: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FAFAFA",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 22,
  },
  chatAction: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  chatButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
});
