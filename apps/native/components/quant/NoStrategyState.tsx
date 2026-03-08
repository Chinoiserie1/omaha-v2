import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useBecomeQuantFull } from "@/hooks/mutations/use-become-quant-full";

interface NoStrategyStateProps {
  onSetupStarted?: () => void;
}

export function NoStrategyState({ onSetupStarted }: NoStrategyStateProps) {
  const { mutate, isPending } = useBecomeQuantFull();

  const handleGenerate = () => {
    mutate(undefined, {
      onSuccess: () => {
        onSetupStarted?.();
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons
          name="analytics-outline"
          size={48}
          color="#71717A"
        />
      </View>
      <Text style={styles.title}>Generate Your Strategy</Text>
      <Text style={styles.description}>
        Analyze your Twitter activity to build a portfolio strategy, or start
        with a default USDC position and refine it via AI chat.
      </Text>
      <Button
        variant="classic"
        className="mt-6 w-full px-8"
        onPress={handleGenerate}
        disabled={isPending}
      >
        <Text className="text-primary-foreground font-semibold">
          {isPending ? "Generating..." : "Generate Strategy"}
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
