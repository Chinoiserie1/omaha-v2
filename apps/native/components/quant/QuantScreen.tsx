import { useState, useEffect } from "react";
import { View, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { useMyProfile } from "@/hooks/queries/use-profile";
import { useQuantPortfolio } from "@/hooks/queries/use-quant-portfolio";
import { useQuantVault } from "@/hooks/queries/use-quant-vault";
import { useQuantSetupStatus } from "@/hooks/queries/use-quant-setup-status";
import { NotQuantState } from "./NotQuantState";
import { NoStrategyState } from "./NoStrategyState";
import { SetupLoadingState } from "./SetupLoadingState";
import { ThesisCard } from "./ThesisCard";
import { AssetsSection } from "./AssetsSection";
import { CreateVaultCta } from "./CreateVaultCta";
import { VaultOverview } from "./VaultOverview";
import { ChatButton } from "./ChatButton";
import { DemoButton, DemoFlow } from "@/components/demo";
import type { Allocation } from "@repo/shared";

function StrategyContent({
  portfolio,
  vault,
}: {
  portfolio: {
    thesisSummary: string;
    allocations: Allocation[];
    createdAt: string;
  };
  vault: {
    id: string;
    vaultName: string;
    vaultSymbol: string;
    statePda: string;
    isActive: boolean;
    lastRebalancedAt: string | null;
  } | null;
}) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 100, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <ThesisCard
        thesisSummary={portfolio.thesisSummary}
        updatedAt={portfolio.createdAt}
      />

      <AssetsSection allocations={portfolio.allocations ?? []} />

      {vault ? (
        <VaultOverview
          id={vault.id}
          name={vault.vaultName}
          symbol={vault.vaultSymbol}
          totalEquityUsd={0}
          holdingsCount={(portfolio.allocations ?? []).length}
          statePda={vault.statePda}
          isActive={vault.isActive}
          lastRebalancedAt={vault.lastRebalancedAt}
        />
      ) : (
        <CreateVaultCta />
      )}

      <ChatButton />
    </ScrollView>
  );
}

export function QuantScreen() {
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const quantId = profile?.quantId ?? null;

  const { data: portfolio, isLoading: portfolioLoading } =
    useQuantPortfolio(quantId);
  const { data: vault } = useQuantVault(quantId);

  // Track whether we're in the setup flow
  const [isSettingUp, setIsSettingUp] = useState(false);
  const pollingEnabled = !!quantId && isSettingUp;

  const { data: setupStatus } = useQuantSetupStatus(quantId, pollingEnabled);

  // When setup completes, stop polling
  useEffect(() => {
    if (setupStatus?.status === "complete" || setupStatus?.status === "failed") {
      setIsSettingUp(false);
    }
  }, [setupStatus?.status]);

  const [demoVisible, setDemoVisible] = useState(false);

  if (profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // User is not a quant
  if (!quantId) {
    return (
      <View className="flex-1">
        {__DEV__ && (
          <View className="flex-row justify-end px-5 py-2">
            <DemoButton onPress={() => setDemoVisible(true)} />
          </View>
        )}
        <NotQuantState onSetupStarted={() => setIsSettingUp(true)} />
        <DemoFlow
          visible={demoVisible}
          onClose={() => setDemoVisible(false)}
        />
      </View>
    );
  }

  // Setup in progress
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

  // Loading portfolio data
  if (portfolioLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading strategy...</Text>
      </View>
    );
  }

  // Has quant but no portfolio yet
  if (!portfolio) {
    return (
      <View className="flex-1">
        {__DEV__ && (
          <View className="flex-row justify-end px-5 py-2">
            <DemoButton onPress={() => setDemoVisible(true)} />
          </View>
        )}
        <NoStrategyState onSetupStarted={() => setIsSettingUp(true)} />
        <DemoFlow
          visible={demoVisible}
          onClose={() => setDemoVisible(false)}
        />
      </View>
    );
  }

  // Has portfolio (with or without vault)
  return (
    <View className="flex-1">
      {__DEV__ && (
        <View className="flex-row justify-end px-5 py-2">
          <DemoButton onPress={() => setDemoVisible(true)} />
        </View>
      )}
      <StrategyContent portfolio={portfolio} vault={vault ?? null} />
      <DemoFlow
        visible={demoVisible}
        onClose={() => setDemoVisible(false)}
      />
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
