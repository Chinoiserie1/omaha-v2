import { View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  TAB_BAR_TOTAL_HEIGHT,
} from "@/components/navigation/tab-bar-constants";

const BUTTON_MARGIN = 8;

export function FixedChatButton() {
  const insets = useSafeAreaInsets();

  // iOS NativeTabs: standard tab bar (~49pt) + safe area
  // Android: custom FloatingGlassTabBar uses TAB_BAR_TOTAL_HEIGHT
  const bottomOffset = Platform.select({
    ios: 49 + insets.bottom + BUTTON_MARGIN,
    default: TAB_BAR_TOTAL_HEIGHT + insets.bottom + BUTTON_MARGIN,
  });

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: bottomOffset,
        paddingHorizontal: 20,
      }}
      pointerEvents="box-none"
    >
      <Button
        variant="classic"
        className="flex-row gap-2"
        size="lg"
        onPress={() => router.push("/(app)/(tabs)/(chat)")}
      >
        <Ionicons name="sparkles" size={18} color="#FAFAFA" />
        <Text className="text-primary-foreground font-semibold">
          Manage Portfolio
        </Text>
      </Button>
    </View>
  );
}
