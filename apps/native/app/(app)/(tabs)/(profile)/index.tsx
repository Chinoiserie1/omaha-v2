import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import type { PortfolioItem } from "@repo/shared";
import { useMyProfile } from "../../../../hooks/queries/use-profile";
import { useWalletPortfolio } from "../../../../hooks/queries/use-wallet-portfolio";
import { usePortfolioChart } from "../../../../hooks/queries/use-portfolio-chart";
import { useActiveTheses } from "../../../../hooks/queries/use-active-theses";
import { PortfolioHeader } from "../../../../components/profile/PortfolioHeader";
import { NetWorthDisplay } from "../../../../components/profile/NetWorthDisplay";
import { UsdcBalanceLabel } from "../../../../components/profile/UsdcBalanceLabel";
import { GasGaugeBar } from "../../../../components/profile/GasGaugeBar";
import { QuickActions } from "../../../../components/profile/QuickActions";
import { PortfolioPerformanceChart } from "../../../../components/profile/PortfolioPerformanceChart";
import { ActiveThesisList } from "../../../../components/profile/ActiveThesisList";
import { PortfolioSignOutButton } from "../../../../components/profile/PortfolioSignOutButton";
import { ProfileScreenSkeleton } from "../../../../components/profile/skeletons";

function findToken(
  items: PortfolioItem[],
  symbol: string,
): Extract<PortfolioItem, { type: "token" }> | undefined {
  return items.find(
    (item): item is Extract<PortfolioItem, { type: "token" }> =>
      item.type === "token" && item.symbol.toUpperCase() === symbol,
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const walletAddress = wallet?.address;
  const { data: portfolio, isLoading: portfolioLoading } = useWalletPortfolio(
    walletAddress,
  );
  const { data: dailyChart } = usePortfolioChart(walletAddress, "1d");
  const { data: activeTheses } = useActiveTheses(walletAddress);

  const portfolioItems = portfolio?.items ?? [];
  const solToken = findToken(portfolioItems, "SOL");
  const usdcToken = findToken(portfolioItems, "USDC");

  if (profileLoading) {
    return <ProfileScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <PortfolioHeader
          profileImageUrl={profile?.profileImageUrl}
          name={profile?.name}
          username={profile?.twitterUsername ?? profile?.username}
        />

        <NetWorthDisplay
          totalUsd={portfolio?.totalUsd ?? 0}
          dailyChangePercent={dailyChart?.percentChange ?? 0}
          isLoading={portfolioLoading}
        />

        <UsdcBalanceLabel amount={usdcToken?.amount ?? 0} />
        <GasGaugeBar
          solAmount={solToken?.amount ?? 0}
          solValueUsd={solToken?.valueUsd ?? 0}
          onTopUp={() =>
            router.push("/(app)/(tabs)/(profile)/fund-sol" as never)
          }
        />

        <QuickActions
          onDeposit={() =>
            router.push("/(app)/(tabs)/(profile)/deposit" as never)
          }
          onWithdraw={() =>
            router.push("/(app)/(tabs)/(profile)/withdraw" as never)
          }
        />

        <PortfolioPerformanceChart walletAddress={walletAddress} />

        <ActiveThesisList
          theses={activeTheses ?? []}
          onThesisPress={(vaultId) =>
            router.push(
              `/(app)/(tabs)/(profile)/vault/${vaultId}` as never,
            )
          }
        />

        <PortfolioSignOutButton />
      </ScrollView>
    </SafeAreaView>
  );
}
