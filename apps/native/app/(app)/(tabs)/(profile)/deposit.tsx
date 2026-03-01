import { SafeAreaView } from "react-native-safe-area-context";
import { DepositSheet } from "../../../../components/profile/DepositSheet";

export default function DepositScreen() {
  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <DepositSheet />
    </SafeAreaView>
  );
}
