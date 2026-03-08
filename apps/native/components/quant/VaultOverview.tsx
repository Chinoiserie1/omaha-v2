import { View } from "react-native";
import { memo } from "react";
import { router } from "expo-router";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatUsd, formatDate } from "@/lib/format";

interface VaultOverviewProps {
  id: string;
  name: string;
  symbol: string;
  totalEquityUsd: number;
  holdingsCount: number;
  statePda: string;
  isActive: boolean;
  lastRebalancedAt: string | null;
}

export const VaultOverview = memo(function VaultOverview({
  id,
  name,
  symbol,
  totalEquityUsd,
  holdingsCount,
  statePda,
  isActive,
  lastRebalancedAt,
}: VaultOverviewProps) {
  const truncatedPda = `${statePda.slice(0, 6)}...${statePda.slice(-4)}`;

  return (
    <Card className="mx-5">
      <CardHeader>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            On-Chain Vault
          </Text>
          <Badge
            variant="secondary"
            className={isActive ? "bg-emerald-900/40" : "bg-red-900/40"}
          >
            <Text
              className={`text-[10px] font-semibold ${isActive ? "text-emerald-400" : "text-red-400"}`}
            >
              {isActive ? "Active" : "Inactive"}
            </Text>
          </Badge>
        </View>
        <Text className="text-lg font-bold text-foreground">
          {name}{" "}
          <Text className="text-sm text-muted-foreground">({symbol})</Text>
        </Text>
      </CardHeader>
      <CardContent className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Total Equity</Text>
          <Text className="text-sm font-semibold text-foreground">
            {formatUsd(totalEquityUsd)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Holdings</Text>
          <Text className="text-sm font-semibold text-foreground">
            {holdingsCount} assets
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Address</Text>
          <Text className="text-sm font-mono text-muted-foreground">
            {truncatedPda}
          </Text>
        </View>
        {lastRebalancedAt && (
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted-foreground">
              Last Rebalanced
            </Text>
            <Text className="text-sm text-muted-foreground">
              {formatDate(lastRebalancedAt)}
            </Text>
          </View>
        )}
        <Button
          variant="classic"
          className="mt-2"
          onPress={() => router.push(`/(app)/(tabs)/(home)/vault/${id}`)}
        >
          <Text className="text-primary-foreground font-semibold">
            View Vault
          </Text>
        </Button>
      </CardContent>
    </Card>
  );
});
