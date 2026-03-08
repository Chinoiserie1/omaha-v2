import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

export function NotQuantState() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name="sparkles-outline" size={56} color="#71717A" />
      </View>
      <Text style={styles.title}>Become a Quant</Text>
      <Text style={styles.description}>
        Create your own trading strategy profile and unlock the AI chat
        assistant to help you analyze markets and optimize your portfolio.
      </Text>
      <Button variant="classic" className="mt-6 w-full px-8" onPress={() => {}}>
        <Text className="text-primary-foreground font-semibold">
          Get Started
        </Text>
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
});
