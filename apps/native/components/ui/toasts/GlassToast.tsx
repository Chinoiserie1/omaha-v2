import { View, Text, StyleSheet, Platform } from "react-native";
import { GlassView } from "@/components/ui/glass";
type ToastVariant = "success" | "error";

type GlassToastProps = {
  readonly type: ToastVariant;
  readonly text1?: string | undefined;
  readonly text2?: string | undefined;
};

const ACCENT = {
  success: "#10b981",
  error: "#ef4444",
} as const;

const OVERLAY = {
  success: "rgba(16, 185, 129, 0.08)",
  error: "rgba(239, 68, 68, 0.08)",
} as const;

const THEME = {
  border: "rgba(255,255,255,0.12)",
  shadow: "rgba(0,0,0,0.40)",
  textPrimary: "#FAFAFA",
  textSecondary: "#A1A1AA",
};

export function GlassToast({ type, text1, text2 }: GlassToastProps) {
  const accent = ACCENT[type];
  const overlay = OVERLAY[type];

  return (
    <GlassView
      effect="regular"
      style={[
        styles.outer,
        {
          borderColor: THEME.border,
          ...Platform.select({
            ios: {
              shadowColor: THEME.shadow,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 1,
              shadowRadius: 16,
            },
            android: { elevation: 8 },
          }),
        },
      ]}
      className="rounded-2xl border"
    >
      <View style={[styles.overlay, { backgroundColor: overlay }]} />

      <View style={styles.content}>
        <View style={[styles.indicator, { backgroundColor: accent }]} />

        <View style={styles.textContainer}>
          {text1 ? (
            <Text
              style={[styles.title, { color: THEME.textPrimary }]}
              numberOfLines={1}
            >
              {text1}
            </Text>
          ) : null}
          {text2 ? (
            <Text
              style={[styles.message, { color: THEME.textSecondary }]}
              numberOfLines={2}
            >
              {text2}
            </Text>
          ) : null}
        </View>
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: "90%",
    overflow: "hidden",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
});
