import { SafeAreaView } from "react-native-safe-area-context";
import { WithdrawForm } from "../../../../components/profile/WithdrawForm";

export default function WithdrawScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <WithdrawForm />
    </SafeAreaView>
  );
}
