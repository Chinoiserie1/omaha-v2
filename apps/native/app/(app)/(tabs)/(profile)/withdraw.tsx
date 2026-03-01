import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { WithdrawForm } from "../../../../components/profile/WithdrawForm";
import { useTabBarVisibility } from "../../../../contexts/tab-bar-visibility";

export default function WithdrawScreen() {
  const { hideTabBar, showTabBar } = useTabBarVisibility();

  useEffect(() => {
    hideTabBar();
    return () => showTabBar();
  }, [hideTabBar, showTabBar]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <WithdrawForm />
    </SafeAreaView>
  );
}
