import { useState } from "react";
import { Pressable, View } from "react-native";
import { Fuel, AlertTriangle, CheckCircle, Info } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { GlassView } from "@/components/ui/glass";

const INFO_TEXT =
  "SOL is needed to pay Solana network fees (like gas). Keep a small balance so your transactions go through. Tap Top Up to convert a little USDC into SOL.";

interface GasGaugeBarProps {
  solAmount: number;
  solValueUsd: number;
  onTopUp: () => void;
}

const SOL_GOOD_THRESHOLD = 0.05;
const SOL_LOW_THRESHOLD = 0.01;

type GasState = "good" | "low" | "critical";

function getGasState(solAmount: number): GasState {
  if (solAmount >= SOL_GOOD_THRESHOLD) return "good";
  if (solAmount >= SOL_LOW_THRESHOLD) return "low";
  return "critical";
}

const BAR_COLORS: Record<Exclude<GasState, "good">, string> = {
  low: "#F59E0B",
  critical: "#EF4444",
};

function formatSolAmount(amount: number): string {
  if (amount < 0.001) return amount.toFixed(6);
  return amount.toFixed(3);
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function GoodState() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Fuel size={12} color="#94a3b8" />
          <Text className="text-xs text-muted-foreground">Transaction Fees</Text>
          <Pressable onPress={() => setShowInfo((v) => !v)} hitSlop={8}>
            <Info size={10} color="#94a3b8" />
          </Pressable>
        </View>
        <View className="flex-row items-center gap-1">
          <CheckCircle size={10} color="#14B8A6" />
          <Text className="text-xs" style={{ color: "#14B8A6" }}>
            Good
          </Text>
        </View>
      </View>
      {showInfo && (
        <Text className="text-[10px] leading-tight text-muted-foreground">
          {INFO_TEXT}
        </Text>
      )}
    </View>
  );
}

function ExpandedState({
  state,
  solAmount,
  solValueUsd,
  onTopUp,
}: {
  state: "low" | "critical";
  solAmount: number;
  solValueUsd: number;
  onTopUp: () => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const barColor = BAR_COLORS[state];
  const fillPercent = Math.min(Math.max((solAmount / SOL_GOOD_THRESHOLD) * 100, 0), 100);
  const isCritical = state === "critical";

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1.5">
        {isCritical ? (
          <AlertTriangle size={12} color="#F59E0B" />
        ) : (
          <Fuel size={12} color="#94a3b8" />
        )}
        <Text
          className="text-xs font-medium"
          style={isCritical ? { color: "#F59E0B" } : undefined}
        >
          {isCritical ? "Low Transaction Fees" : "Transaction Fees"}
        </Text>
        <Pressable onPress={() => setShowInfo((v) => !v)} hitSlop={8}>
          <Info size={10} color="#94a3b8" />
        </Pressable>
      </View>

      {showInfo && (
        <Text className="text-[10px] leading-tight text-muted-foreground">
          {INFO_TEXT}
        </Text>
      )}

      <View className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <View
          className="h-full rounded-full"
          style={{ width: `${fillPercent}%`, backgroundColor: barColor }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] text-muted-foreground">
          {formatSolAmount(solAmount)} SOL · {formatUsd(solValueUsd)}
        </Text>
        <Button
          variant={isCritical ? "classic" : "ghost"}
          size="sm"
          onPress={onTopUp}
          className="h-6 px-2"
        >
          <Text className="text-[10px]">{isCritical ? "Top Up Now" : "Top Up"}</Text>
        </Button>
      </View>
    </View>
  );
}

export function GasGaugeBar({ solAmount, solValueUsd, onTopUp }: GasGaugeBarProps) {
  const state = getGasState(solAmount);

  return (
    <GlassView className="mb-4 rounded-lg px-3 py-2">
      {state === "good" ? (
        <GoodState />
      ) : (
        <ExpandedState
          state={state}
          solAmount={solAmount}
          solValueUsd={solValueUsd}
          onTopUp={onTopUp}
        />
      )}
    </GlassView>
  );
}
