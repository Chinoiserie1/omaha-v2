import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { QuantScreen } from "@/components/quant";
import { useActiveTab } from "@/contexts/active-tab";

export default function QuantRoute() {
  if (Platform.OS === "ios") {
    return <IOSQuantScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <QuantScreen />
    </SafeAreaView>
  );
}

function IOSQuantScreen() {
  const { setActiveTab, clearActiveTab } = useActiveTab();

  useFocusEffect(
    useCallback(() => {
      setActiveTab("(quant)");
      return () => clearActiveTab("(quant)");
    }, [setActiveTab, clearActiveTab]),
  );

  return <QuantScreen />;
}
