import { SafeAreaView } from "react-native-safe-area-context";
import { FundSolSheet } from "../../../../components/profile/fund-sol";

export default function FundSolScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <FundSolSheet />
    </SafeAreaView>
  );
}
