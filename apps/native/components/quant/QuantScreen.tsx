import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { Text } from "@/components/ui/text";
import { useMyProfile } from "@/hooks/queries/use-profile";
import { useQuantPortfolio } from "@/hooks/queries/use-quant-portfolio";
import { useQuantVault } from "@/hooks/queries/use-quant-vault";
import { useQuantSetupStatus } from "@/hooks/queries/use-quant-setup-status";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { VaultThesis } from "@/components/vault/VaultThesis";
import { VaultAllocationCard } from "@/components/vault/VaultAllocationCard";
import { NotQuantState } from "./NotQuantState";
import { NoStrategyState } from "./NoStrategyState";
import { SetupLoadingState } from "./SetupLoadingState";
import { VaultOverview } from "./VaultOverview";
import { QuantHeader } from "./QuantHeader";
import { FixedChatButton } from "./FixedChatButton";
import type { Allocation } from "@repo/shared";

interface PortfolioData {
  thesisSummary: string;
  allocations: Allocation[];
  createdAt: string;
}

interface VaultData {
  id: string;
  vaultName: string;
  vaultSymbol: string;
  statePda: string;
  isActive: boolean;
  lastRebalancedAt: string | null;
}

interface ProfileInfo {
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

type QuantSection =
  | { type: "header"; data: ProfileInfo & { updatedAt: string | null } }
  | { type: "thesis"; data: { thesisSummary: string; updatedAt: string } }
  | { type: "allocations-header"; data: { count: number } }
  | { type: "allocation"; data: Allocation }
  | { type: "vault-overview"; data: VaultData & { holdingsCount: number } };

function buildSections(
  profile: ProfileInfo,
  portfolio: PortfolioData,
  vault: VaultData | null,
): QuantSection[] {
  const sections: QuantSection[] = [
    {
      type: "header",
      data: { ...profile, updatedAt: portfolio.createdAt },
    },
  ];

  if (portfolio.thesisSummary) {
    sections.push({
      type: "thesis",
      data: {
        thesisSummary: portfolio.thesisSummary,
        updatedAt: portfolio.createdAt,
      },
    });
  }

  const allocations = portfolio.allocations ?? [];
  if (allocations.length > 0) {
    sections.push({
      type: "allocations-header",
      data: { count: allocations.length },
    });
    for (const alloc of allocations) {
      sections.push({ type: "allocation", data: alloc });
    }
  }

  if (vault) {
    sections.push({
      type: "vault-overview",
      data: { ...vault, holdingsCount: allocations.length },
    });
  }

  return sections;
}

function StrategyContent({
  profile,
  portfolio,
  vault,
}: {
  profile: ProfileInfo;
  portfolio: PortfolioData;
  vault: VaultData | null;
}) {
  const handleSparklesPress = useCallback(() => {
    router.push("/(app)/(tabs)/(chat)");
  }, []);

  const sections = useMemo(
    () => buildSections(profile, portfolio, vault),
    [profile, portfolio, vault],
  );

  const renderItem = useCallback(
    ({ item }: { item: QuantSection }) => {
      let content: React.ReactNode = null;

      switch (item.type) {
        case "header":
          content = (
            <QuantHeader
              displayName={item.data.displayName}
              username={item.data.username}
              avatarUrl={item.data.avatarUrl}
              updatedAt={item.data.updatedAt}
              onSparklesPress={handleSparklesPress}
            />
          );
          break;
        case "thesis":
          content = (
            <VaultThesis
              thesisSummary={item.data.thesisSummary}
              updatedAt={item.data.updatedAt}
            />
          );
          break;
        case "allocations-header":
          content = (
            <View className="flex-row items-center px-5">
              <Text className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Assets Involved
              </Text>
              <View
                className="justify-center items-center ml-2 rounded-full"
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{ color: "#3B82F6", fontSize: 10, fontWeight: "600" }}
                >
                  {item.data.count}
                </Text>
              </View>
            </View>
          );
          break;
        case "allocation":
          content = (
            <VaultAllocationCard
              asset={item.data.asset}
              percentage={item.data.percentage}
              conviction={item.data.conviction}
              reasoning={item.data.reasoning}
              logoUri={item.data.logoUri}
            />
          );
          break;
        case "vault-overview":
          content = (
            <VaultOverview
              id={item.data.id}
              name={item.data.vaultName}
              symbol={item.data.vaultSymbol}
              totalEquityUsd={0}
              holdingsCount={item.data.holdingsCount}
              statePda={item.data.statePda}
              isActive={item.data.isActive}
              lastRebalancedAt={item.data.lastRebalancedAt}
            />
          );
          break;
        default:
          return null;
      }

      return <View className="mb-4">{content}</View>;
    },
    [handleSparklesPress],
  );

  const getItemType = useCallback((item: QuantSection) => item.type, []);
  const keyExtractor = useCallback(
    (item: QuantSection, index: number) => `${item.type}-${index}`,
    [],
  );

  return (
    <FlashList
      data={sections}
      renderItem={renderItem}
      getItemType={getItemType}
      keyExtractor={keyExtractor}

      contentContainerStyle={{ paddingBottom: 160 }}
      showsVerticalScrollIndicator={false}
    />
  );
}

export function QuantScreen() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const quantId = profile?.quantId ?? null;

  const { data: portfolio, isLoading: portfolioLoading } =
    useQuantPortfolio(quantId);
  const { data: vault } = useQuantVault(quantId);

  const [isSettingUp, setIsSettingUp] = useState(false);
  const pollingEnabled = !!quantId && isSettingUp;

  const { data: setupStatus } = useQuantSetupStatus(quantId, pollingEnabled);

  const hasInvalidated = useRef(false);

  useEffect(() => {
    if (setupStatus?.status === "complete" && isSettingUp && quantId && !hasInvalidated.current) {
      hasInvalidated.current = true;
      queryClient.invalidateQueries({
        queryKey: queryKeys.quant.portfolio(quantId),
      });
      setIsSettingUp(false);
    } else if (setupStatus?.status === "failed") {
      setIsSettingUp(false);
    }
  }, [setupStatus?.status, isSettingUp, quantId, queryClient]);

  const profileInfo: ProfileInfo = useMemo(
    () => ({
      displayName: profile?.name ?? profile?.twitterUsername ?? "Quant",
      username: profile?.twitterUsername ?? profile?.username ?? "unknown",
      avatarUrl: profile?.profileImageUrl ?? null,
    }),
    [profile?.name, profile?.twitterUsername, profile?.username, profile?.profileImageUrl],
  );

  if (profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!quantId) {
    return (
      <View className="flex-1">
        <NotQuantState onSetupStarted={() => { hasInvalidated.current = false; setIsSettingUp(true); }} />
      </View>
    );
  }

  if (isSettingUp && setupStatus && setupStatus.status !== "complete") {
    return (
      <View className="flex-1">
        <SetupLoadingState
          status={setupStatus.status}
          error={setupStatus.error}
        />
      </View>
    );
  }

  if (portfolioLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading strategy...</Text>
      </View>
    );
  }

  if (!portfolio) {
    return (
      <View className="flex-1">
        <NoStrategyState onSetupStarted={() => { hasInvalidated.current = false; setIsSettingUp(true); }} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <StrategyContent
        profile={profileInfo}
        portfolio={portfolio}
        vault={vault ?? null}
      />
      <FixedChatButton />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#71717A",
    fontSize: 14,
  },
});
