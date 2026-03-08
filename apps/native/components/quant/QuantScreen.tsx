import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { NotQuantState } from "./NotQuantState";
import { NoStrategyState } from "./NoStrategyState";
import { ThesisCard } from "./ThesisCard";
import { PerformanceSection } from "./PerformanceSection";
import { AssetsSection } from "./AssetsSection";
import { CreateVaultCta } from "./CreateVaultCta";
import { VaultOverview } from "./VaultOverview";
import { ChatButton } from "./ChatButton";
import { DemoButton, DemoFlow } from "@/components/demo";
import type { MockQuantState } from "./quant-mock-data";
import {
  MOCK_THESIS,
  MOCK_ALLOCATIONS,
  MOCK_PERFORMANCE,
  MOCK_VAULT,
  MOCK_STRATEGY_UPDATED_AT,
} from "./quant-mock-data";

const STATE_LABELS: { key: MockQuantState; label: string }[] = [
  { key: "not-quant", label: "User" },
  { key: "quant-no-strategy", label: "No Strat" },
  { key: "quant-with-strategy", label: "Strategy" },
  { key: "quant-with-vault", label: "Vault" },
];

function DevStateSwitcher({
  current,
  onSwitch,
}: {
  current: MockQuantState;
  onSwitch: (state: MockQuantState) => void;
}) {
  return (
    <View className="flex-row justify-center gap-2 px-5 py-3">
      {STATE_LABELS.map(({ key, label }) => (
        <Pressable
          key={key}
          onPress={() => onSwitch(key)}
          className={`px-3 py-1.5 rounded-full border ${
            current === key
              ? "bg-blue-600 border-blue-500"
              : "bg-card border-border"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              current === key ? "text-white" : "text-muted-foreground"
            }`}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function StrategyContent({ hasVault }: { hasVault: boolean }) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 100, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <ThesisCard
        thesisSummary={MOCK_THESIS}
        updatedAt={MOCK_STRATEGY_UPDATED_AT}
      />

      <PerformanceSection
        currentValue={MOCK_PERFORMANCE.currentValue}
        change24h={MOCK_PERFORMANCE.change24h}
        change7d={MOCK_PERFORMANCE.change7d}
        change30d={MOCK_PERFORMANCE.change30d}
        changeAll={MOCK_PERFORMANCE.changeAll}
      />

      <AssetsSection allocations={MOCK_ALLOCATIONS} />

      {hasVault ? (
        <VaultOverview
          id={MOCK_VAULT.id}
          name={MOCK_VAULT.name}
          symbol={MOCK_VAULT.symbol}
          totalEquityUsd={MOCK_VAULT.totalEquityUsd}
          holdingsCount={MOCK_VAULT.holdingsCount}
          statePda={MOCK_VAULT.statePda}
          isActive={MOCK_VAULT.isActive}
          lastRebalancedAt={MOCK_VAULT.lastRebalancedAt}
        />
      ) : (
        <CreateVaultCta />
      )}

      <ChatButton />
    </ScrollView>
  );
}

export function QuantScreen() {
  const [mockState, setMockState] =
    useState<MockQuantState>("quant-with-vault");
  const [demoVisible, setDemoVisible] = useState(false);

  return (
    <View className="flex-1">
      {__DEV__ && (
        <View className="flex-row items-center justify-between px-5">
          <DevStateSwitcher current={mockState} onSwitch={setMockState} />
          <DemoButton onPress={() => setDemoVisible(true)} />
        </View>
      )}

      {mockState === "not-quant" && <NotQuantState />}
      {mockState === "quant-no-strategy" && <NoStrategyState />}
      {mockState === "quant-with-strategy" && (
        <StrategyContent hasVault={false} />
      )}
      {mockState === "quant-with-vault" && <StrategyContent hasVault />}

      <DemoFlow
        visible={demoVisible}
        onClose={() => setDemoVisible(false)}
      />
    </View>
  );
}
