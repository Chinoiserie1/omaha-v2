import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import type { SetupStatus } from "@/hooks/queries/use-quant-setup-status";

interface SetupLoadingStateProps {
  status: SetupStatus;
  error?: string | undefined;
}

const STEP_CONFIG: {
  status: SetupStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { status: "syncing_profile", label: "Syncing your profile...", icon: "person-outline" },
  { status: "fetching_tweets", label: "Analyzing your Twitter...", icon: "logo-twitter" },
  { status: "classifying", label: "Categorizing signals...", icon: "filter-outline" },
  { status: "synthesizing", label: "Building portfolio...", icon: "pie-chart-outline" },
];

function getStepIndex(status: SetupStatus): number {
  const idx = STEP_CONFIG.findIndex((s) => s.status === status);
  return idx >= 0 ? idx : 0;
}

export function SetupLoadingState({ status, error }: SetupLoadingStateProps) {
  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={56} color="#EF4444" />
        <Text style={styles.title}>Setup Failed</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const currentIdx = getStepIndex(status);

  return (
    <View style={styles.container}>
      <Ionicons name="sparkles" size={56} color="#3B82F6" />
      <Text style={styles.title}>Setting up your Quant profile</Text>
      <Text style={styles.subtitle}>This may take a minute...</Text>

      <View style={styles.steps}>
        {STEP_CONFIG.map((step, idx) => {
          const isActive = idx === currentIdx;
          const isDone = idx < currentIdx;
          const color = isDone ? "#22C55E" : isActive ? "#3B82F6" : "#71717A";

          return (
            <View key={step.status} style={styles.stepRow}>
              <Ionicons
                name={isDone ? "checkmark-circle" : step.icon}
                size={20}
                color={color}
              />
              <Text style={[styles.stepLabel, { color }]}>
                {step.label}
              </Text>
            </View>
          );
        })}
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FAFAFA",
    marginTop: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#71717A",
    marginBottom: 32,
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    marginTop: 12,
    textAlign: "center",
  },
  steps: {
    gap: 16,
    width: "100%",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
});
