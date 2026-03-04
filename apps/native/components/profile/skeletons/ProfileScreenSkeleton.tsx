import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PortfolioHeaderSkeleton } from "./PortfolioHeaderSkeleton";
import { NetWorthSkeleton } from "./NetWorthSkeleton";
import { BalanceAreaSkeleton } from "./AssetCardsSkeleton";
import { QuickActionsSkeleton } from "./QuickActionsSkeleton";
import { PerformanceChartSkeleton } from "./PerformanceChartSkeleton";
import { ActiveThesesSkeleton } from "./ActiveThesesSkeleton";

export function ProfileScreenSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <PortfolioHeaderSkeleton />
        <NetWorthSkeleton />
        <BalanceAreaSkeleton />
        <QuickActionsSkeleton />
        <PerformanceChartSkeleton />
        <ActiveThesesSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
}
