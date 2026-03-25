import { SafeAreaView } from "react-native-safe-area-context";
import { QuantScreen } from "@/components/quant";

export default function QuantRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <QuantScreen />
    </SafeAreaView>
  );
}
