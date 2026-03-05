import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import { VaultHeader } from "./VaultHeader";
import { VaultThesis } from "./VaultThesis";
import { VaultAllocationCard } from "./VaultAllocationCard";
import { VaultChanges } from "./VaultChanges";
import { VaultInvestmentCard } from "./VaultInvestmentCard";
import { VaultPerformanceChart } from "./VaultPerformanceChart";
import { InvestHeaderButton } from "./InvestHeaderButton";
import { FavoriteHeaderButton } from "./FavoriteHeaderButton";
import { VaultTextSection } from "./VaultTextSection";
import { useVault } from "../../hooks/queries/use-vaults";
import { useVaultRebalances } from "../../hooks/queries/use-vault-rebalances";
import type { RebalanceWithSnapshot } from "../../hooks/queries/use-vault-rebalances";

interface Allocation {
  asset: string;
  mint?: string;
  percentage: number;
  conviction: "low" | "medium" | "high" | "stale";
  reasoning: string;
  since: string;
  lastSignal: string;
}

interface VaultData {
  id: string;
  name: string;
  description: string;
  quantUsername: string;
  quantId: string;
  glamStatePda: string;
  glamVaultPda: string | null;
  mintAddress: string | null;
  isActive: boolean;
  about: string;
  dataSource: string;
  performanceCalc: string;
  disclosure: string;
  quant: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
  };
  portfolio: {
    thesisSummary: string;
    allocations: Allocation[];
    changes: string[];
    updatedAt: string;
  } | null;
}

type VaultSection =
  | { type: "header"; data: VaultData }
  | { type: "stats"; data: VaultData }
  | { type: "performance"; data: { vaultId: string } }
  | { type: "investment"; data: VaultData }
  | { type: "thesis"; data: { thesisSummary: string; updatedAt: string } }
  | { type: "allocations-header"; data: { count: number } }
  | { type: "allocation"; data: Allocation }
  | { type: "changes"; data: { rebalances: RebalanceWithSnapshot[] } }
  | { type: "description"; data: string }
  | { type: "about"; data: { title: string; content: string } }
  | { type: "data-source"; data: { title: string; content: string } }
  | { type: "performance-calc"; data: { title: string; content: string } }
  | { type: "disclosure"; data: { title: string; content: string } };

interface VaultDetailProps {
  vaultId: string;
  onBack: () => void;
  onInvest: () => void;
  onWithdraw: () => void;
}

function buildSections(
  vault: VaultData,
  rebalances: RebalanceWithSnapshot[],
): VaultSection[] {
  const sections: VaultSection[] = [{ type: "header", data: vault }];

  if (vault.portfolio?.thesisSummary) {
    sections.push({
      type: "thesis",
      data: {
        thesisSummary: vault.portfolio.thesisSummary,
        updatedAt: vault.portfolio.updatedAt,
      },
    });
  }

  sections.push(
    { type: "stats", data: vault },
    { type: "performance", data: { vaultId: vault.id } },
    { type: "investment", data: vault },
  );

  const allocations = vault.portfolio?.allocations ?? [];
  if (allocations.length > 0) {
    sections.push({
      type: "allocations-header",
      data: { count: allocations.length },
    });
    for (const alloc of allocations) {
      sections.push({ type: "allocation", data: alloc });
    }
  }

  if (rebalances.length > 0) {
    sections.push({
      type: "changes",
      data: { rebalances },
    });
  }

  if (vault.about) {
    sections.push({
      type: "about",
      data: { title: "About", content: vault.about },
    });
  }
  if (vault.dataSource) {
    sections.push({
      type: "data-source",
      data: { title: "Data Source", content: vault.dataSource },
    });
  }
  if (vault.performanceCalc) {
    sections.push({
      type: "performance-calc",
      data: {
        title: "Performance Calculation",
        content: vault.performanceCalc,
      },
    });
  }
  if (vault.disclosure) {
    sections.push({
      type: "disclosure",
      data: { title: "Disclosure", content: vault.disclosure },
    });
  }

  return sections;
}

export function VaultDetail({
  vaultId,
  onBack,
  onInvest,
  onWithdraw,
}: VaultDetailProps) {
  const { data: vault, isLoading, error, refetch } = useVault(vaultId);
  const { data: rebalances } = useVaultRebalances(vaultId);
  const queryClient = useQueryClient();
  const iconColor = "#F8FAFC";

  console.log("rebalance events", rebalances);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.detail(vaultId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.rebalances(vaultId),
      }),
    ]);
    setIsRefreshing(false);
  }, [queryClient, vaultId]);

  const sections = useMemo(
    () => (vault ? buildSections(vault as VaultData, rebalances ?? []) : []),
    [vault, rebalances],
  );

  const renderItem = useCallback(
    ({ item }: { item: VaultSection }) => {
      let content: React.ReactNode = null;

      switch (item.type) {
        case "header":
          content = (
            <VaultHeader
              name={item.data.name}
              quantUsername={item.data.quantUsername}
              isActive={item.data.isActive}
              avatarUrl={item.data.quant.avatarUrl}
              updatedAt={item.data.portfolio?.updatedAt}
            />
          );
          break;
        case "description":
          content = (
            <Text className="px-5 mx-4 text-sm leading-5 text-center text-muted-foreground">
              {item.data}
            </Text>
          );
          break;
        case "performance":
          return <VaultPerformanceChart vaultId={item.data.vaultId} />;
        case "investment":
          content = (
            <VaultInvestmentCard
              vaultId={item.data.id}
              mintAddress={item.data.mintAddress}
              onInvest={onInvest}
              onWithdraw={onWithdraw}
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
            />
          );
          break;
        case "changes":
          content = <VaultChanges {...item.data} />;
          break;
        case "about":
        case "data-source":
        case "performance-calc":
        case "disclosure":
          content = (
            <VaultTextSection
              title={item.data.title}
              content={item.data.content}
            />
          );
          break;
        default:
          return null;
      }

      return <View className="mb-4">{content}</View>;
    },
    [onInvest, onWithdraw],
  );

  const getItemType = useCallback((item: VaultSection) => item.type, []);
  const keyExtractor = useCallback(
    (item: VaultSection, index: number) => `${item.type}-${index}`,
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={onBack}
          className="justify-center items-center w-10 h-10 rounded-full bg-card active:bg-secondary"
        >
          <Ionicons name="chevron-back" size={20} color={iconColor} />
        </Pressable>
        <View className="flex-row flex-1 items-center ml-3">
          <Text
            className="text-base font-semibold shrink text-foreground"
            numberOfLines={1}
          >
            {vault?.name ?? ""}
          </Text>
          {vault && <FavoriteHeaderButton vaultId={vaultId} />}
        </View>
        {vault && <InvestHeaderButton onPress={onInvest} />}
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={iconColor} />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="mb-4 text-base text-center text-muted-foreground">
            {error.message}
          </Text>
          <Pressable
            className="px-6 py-3 bg-white rounded-lg active:opacity-80"
            onPress={() => refetch()}
          >
            <Text className="font-semibold text-background">Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={sections}
          renderItem={renderItem}
          getItemType={getItemType}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}
