import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useBecomeQuantFull } from "@/hooks/mutations/use-become-quant-full";

interface NotQuantStateProps {
  onSetupStarted?: () => void;
}

export function NotQuantState({ onSetupStarted }: NotQuantStateProps) {
  const { mutate, isPending } = useBecomeQuantFull();

  const handleGetStarted = () => {
    mutate(undefined, {
      onSuccess: () => {
        onSetupStarted?.();
      },
    });
  };

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
      <Button
        variant="classic"
        className="mt-6 w-full px-8"
        onPress={handleGetStarted}
        disabled={isPending}
      >
        <Text className="text-primary-foreground font-semibold">
          {isPending ? "Setting up..." : "Get Started"}
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
