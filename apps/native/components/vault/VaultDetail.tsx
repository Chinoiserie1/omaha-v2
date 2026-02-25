import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo } from "react";
import { VaultHeader } from "./VaultHeader";
import { VaultStats } from "./VaultStats";
import { VaultThesis } from "./VaultThesis";
import { VaultAllocationCard } from "./VaultAllocationCard";
import { VaultChanges } from "./VaultChanges";
import { VaultInvestmentCard } from "./VaultInvestmentCard";
import { VaultPerformanceChart } from "./VaultPerformanceChart";
import { InvestHeaderButton } from "./InvestHeaderButton";
import { VaultTextSection } from "./VaultTextSection";
import { useVault } from "../../hooks/queries/use-vaults";

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
  kolUsername: string;
  kolId: string;
  glamStatePda: string;
  glamVaultPda: string | null;
  mintAddress: string | null;
  isActive: boolean;
  about: string;
  dataSource: string;
  performanceCalc: string;
  disclosure: string;
  kol: {
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
  | { type: "allocations-header" }
  | { type: "allocation"; data: Allocation }
  | { type: "changes"; data: string[] }
  | { type: "description"; data: string }
  | { type: "info"; data: VaultData }
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

function buildSections(vault: VaultData): VaultSection[] {
  const sections: VaultSection[] = [{ type: "header", data: vault }];

  if (vault.description) {
    sections.push({ type: "description", data: vault.description });
  }

  sections.push(
    { type: "stats", data: vault },
    { type: "performance", data: { vaultId: vault.id } },
    { type: "investment", data: vault },
  );

  if (vault.portfolio?.thesisSummary) {
    sections.push({
      type: "thesis",
      data: {
        thesisSummary: vault.portfolio.thesisSummary,
        updatedAt: vault.portfolio.updatedAt,
      },
    });
  }

  const allocations = vault.portfolio?.allocations ?? [];
  if (allocations.length > 0) {
    sections.push({ type: "allocations-header" });
    for (const alloc of allocations) {
      sections.push({ type: "allocation", data: alloc });
    }
  }

  if (vault.portfolio?.changes && vault.portfolio.changes.length > 0) {
    sections.push({ type: "changes", data: vault.portfolio.changes });
  }

  sections.push({ type: "info", data: vault });

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

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="px-5 pt-4 pb-2">
      <Text className="text-xs font-semibold tracking-wider uppercase text-zinc-500">
        {title}
      </Text>
    </View>
  );
}

export function VaultDetail({ vaultId, onBack, onInvest, onWithdraw }: VaultDetailProps) {
  const { data: vault, isLoading, error, refetch } = useVault(vaultId);

  const sections = useMemo(
    () => (vault ? buildSections(vault as VaultData) : []),
    [vault],
  );

  const renderItem = useCallback(({ item }: { item: VaultSection }) => {
    switch (item.type) {
      case "header":
        return (
          <VaultHeader
            name={item.data.name}
            kolUsername={item.data.kolUsername}
            isActive={item.data.isActive}
          />
        );
      case "description":
        return (
          <Text className="px-5 mx-4 mb-6 text-sm leading-5 text-center text-zinc-400">
            {item.data}
          </Text>
        );
      case "performance":
        return <VaultPerformanceChart vaultId={item.data.vaultId} />;
      case "investment":
        return (
          <VaultInvestmentCard
            vaultId={item.data.id}
            mintAddress={item.data.mintAddress}
            onInvest={onInvest}
            onWithdraw={onWithdraw}
          />
        );
      case "thesis":
        return (
          <VaultThesis
            thesisSummary={item.data.thesisSummary}
            updatedAt={item.data.updatedAt}
          />
        );
      case "allocations-header":
        return <SectionHeader title="Portfolio Allocation" />;
      case "allocation":
        return (
          <VaultAllocationCard
            asset={item.data.asset}
            percentage={item.data.percentage}
            conviction={item.data.conviction}
            reasoning={item.data.reasoning}
          />
        );
      case "changes":
        return <VaultChanges changes={item.data} />;
      case "about":
      case "data-source":
      case "performance-calc":
        return (
          <VaultTextSection
            title={item.data.title}
            content={item.data.content}
          />
        );
      // case "info":
      //   return (
      //     <VaultInfo
      //       glamStatePda={item.data.glamStatePda}
      //       glamVaultPda={item.data.glamVaultPda}
      //       vaultSymbol={item.data.name}
      //       kolBio={item.data.kol.bio}
      //     />
      //   );
      case "disclosure":
        return (
          <VaultTextSection
            title={item.data.title}
            content={item.data.content}
          />
        );
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onInvest, onWithdraw]);

  const getItemType = useCallback((item: VaultSection) => item.type, []);
  const keyExtractor = useCallback(
    (item: VaultSection, index: number) => `${item.type}-${index}`,
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={["top"]}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={onBack}
          className="justify-center items-center w-10 h-10 rounded-full bg-zinc-900 active:bg-zinc-800"
        >
          <Ionicons name="chevron-back" size={20} color="#FAFAFA" />
        </Pressable>
        <Text
          className="flex-1 ml-3 text-base font-semibold text-white"
          numberOfLines={1}
        >
          {vault?.name ?? ""}
        </Text>
        {vault && <InvestHeaderButton onPress={onInvest} />}
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FAFAFA" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="mb-4 text-base text-center text-zinc-400">
            {error.message}
          </Text>
          <Pressable
            className="px-6 py-3 bg-white rounded-lg active:opacity-80"
            onPress={() => refetch()}
          >
            <Text className="font-semibold text-zinc-950">Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={sections}
          renderItem={renderItem}
          getItemType={getItemType}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

    </SafeAreaView>
  );
}
