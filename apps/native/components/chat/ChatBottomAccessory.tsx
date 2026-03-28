import { Pressable, StyleSheet, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMyProfile } from "@/hooks/queries/use-profile";
import { useBecomeQuantFull } from "@/hooks/mutations/use-become-quant-full";
import { useQuantOnboarding } from "@/contexts/quant-onboarding";

interface ChatBottomAccessoryProps {
  placement: "regular" | "inline";
}

export function ChatBottomAccessory({ placement: _placement }: ChatBottomAccessoryProps) {
  const { data: profile } = useMyProfile();
  const { mutate, isPending } = useBecomeQuantFull();
  const { step, currentStep, isLastStep, goNext, signalSetupStarted } = useQuantOnboarding();
  const isQuant = Boolean(profile?.quantId);

  // Quant user — show "Manage Portfolio"
  if (isQuant) {
    return (
      <Pressable
        style={styles.container}
        onPress={() => router.push("/(app)/(chat)")}
      >
        <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        <Text style={styles.label} numberOfLines={1}>
          Manage Portfolio
        </Text>
      </Pressable>
    );
  }

  // Onboarding active — show step-based CTA
  if (step !== null && currentStep) {
    const handlePress = () => {
      if (isLastStep) {
        mutate(undefined, {
          onSuccess: () => signalSetupStarted(),
        });
      } else {
        goNext();
      }
    };

    return (
      <Pressable
        style={styles.container}
        onPress={handlePress}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name={currentStep.ctaIcon} size={22} color="#FFFFFF" />
        )}
        <Text style={styles.label} numberOfLines={1}>
          {isPending ? "Setting up..." : currentStep.ctaLabel}
        </Text>
      </Pressable>
    );
  }

  // Fallback — no onboarding active, not a quant
  return (
    <Pressable
      style={styles.container}
      onPress={() => mutate()}
      disabled={isPending}
    >
      {isPending ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Ionicons name="rocket-outline" size={22} color="#FFFFFF" />
      )}
      <Text style={styles.label} numberOfLines={1}>
        Get Started
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
