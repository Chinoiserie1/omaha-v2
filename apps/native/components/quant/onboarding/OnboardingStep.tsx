import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import type { OnboardingStepData } from "./onboarding-steps";

type OnboardingStepProps = Pick<
  OnboardingStepData,
  "icon" | "iconColor" | "title" | "description"
>;

export function OnboardingStep({
  icon,
  iconColor,
  title,
  description,
}: OnboardingStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name={icon} size={56} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
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
