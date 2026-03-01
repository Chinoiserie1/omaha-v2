import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface GradientBackgroundProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function GradientBackground({
  children,
  style,
}: GradientBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={["#0F172A", "#1E293B", "#3B82F6"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
