import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

export function NoStrategyState() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={48}
          color="#71717A"
        />
      </View>
      <Text style={styles.title}>Create Your Strategy</Text>
      <Text style={styles.description}>
        Use the AI chat to define your trading thesis and portfolio allocations.
      </Text>
      <Button
        variant="classic"
        className="mt-6 w-full px-8"
        onPress={() => router.push("/(app)/(tabs)/(chat)")}
      >
        <Text className="text-primary-foreground font-semibold">Open Chat</Text>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FAFAFA",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 20,
  },
});
