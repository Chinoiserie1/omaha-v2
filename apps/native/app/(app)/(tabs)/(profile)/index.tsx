import { ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { useMyProfile } from "../../../../hooks/queries/use-profile";
import { useWalletPortfolio } from "../../../../hooks/queries/use-wallet-portfolio";
import { PortfolioHeader } from "../../../../components/profile/PortfolioHeader";
import { NetWorthDisplay } from "../../../../components/profile/NetWorthDisplay";
import { AssetCardsGrid } from "../../../../components/profile/AssetCardsGrid";
import { QuickActions } from "../../../../components/profile/QuickActions";
import { PortfolioPerformanceChart } from "../../../../components/profile/PortfolioPerformanceChart";
import { ActiveThesisList } from "../../../../components/profile/ActiveThesisList";
import { PortfolioSignOutButton } from "../../../../components/profile/PortfolioSignOutButton";
import {
  MOCK_DAILY_CHANGE_PERCENT,
  MOCK_ACTIVE_THESES,
} from "../../../../components/profile/portfolio-mock-data";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const { data: portfolio, isLoading: portfolioLoading } = useWalletPortfolio(
    wallet?.address,
  );

  if (profileLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#94A3B8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <PortfolioHeader
          profileImageUrl={profile?.profileImageUrl}
          name={profile?.name}
          username={profile?.twitterUsername ?? profile?.username}
        />

        <NetWorthDisplay
          totalUsd={portfolio?.totalUsd ?? 0}
          dailyChangePercent={MOCK_DAILY_CHANGE_PERCENT}
          isLoading={portfolioLoading}
        />

        <AssetCardsGrid
          items={portfolio?.items ?? []}
          isLoading={portfolioLoading}
        />

        <QuickActions
          onDeposit={() =>
            router.push("/(app)/(tabs)/(profile)/deposit" as never)
          }
          onWithdraw={() =>
            router.push("/(app)/(tabs)/(profile)/withdraw" as never)
          }
        />

        <PortfolioPerformanceChart />

        <ActiveThesisList theses={MOCK_ACTIVE_THESES} />

        <PortfolioSignOutButton />
      </ScrollView>
    </SafeAreaView>
  );
}
