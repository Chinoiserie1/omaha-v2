import { View, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { TAB_BAR_TOTAL_HEIGHT } from "@/components/navigation/tab-bar-constants";
import type { OnboardingStepData } from "./onboarding-steps";

interface OnboardingBottomBarProps {
  ctaLabel: OnboardingStepData["ctaLabel"];
  ctaIcon: OnboardingStepData["ctaIcon"];
  isPending: boolean;
  onPress: () => void;
}

export function OnboardingBottomBar({
  ctaLabel,
  ctaIcon,
  isPending,
  onPress,
}: OnboardingBottomBarProps) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        style={styles.button}
        onPress={onPress}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name={ctaIcon} size={22} color="#FFFFFF" />
        )}
        <Text style={styles.label}>
          {isPending ? "Setting up..." : ctaLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 32,
    paddingBottom: TAB_BAR_TOTAL_HEIGHT + 28,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#14B8A6",
    paddingVertical: 14,
    borderRadius: 12,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
