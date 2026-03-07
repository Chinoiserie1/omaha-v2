import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";

interface ChatEmptyStateProps {
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  "Analyze my portfolio",
  "Market overview",
  "Explain my thesis",
];

export function ChatEmptyState({ onSuggestion }: ChatEmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name="chatbubble-ellipses-outline" size={48} color="#71717A" />
      </View>
      <Text style={styles.title}>Ask me about your strategy</Text>
      <Text style={styles.subtitle}>
        I can help you analyze markets, review your portfolio, and optimize your
        trading strategy.
      </Text>
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((text) => (
          <Pressable
            key={text}
            style={styles.chip}
            onPress={() => onSuggestion(text)}
          >
            <Text style={styles.chipText}>{text}</Text>
          </Pressable>
        ))}
      </View>
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
  subtitle: {
    fontSize: 14,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  chipText: {
    color: "#E2E8F0",
    fontSize: 13,
  },
});
