import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { useWalletPortfolio } from "../../hooks/queries/use-wallet-portfolio";
import { ExpandableTokenList } from "./ExpandableTokenList";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatTotalUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${value.toFixed(2)}`;
}

export function WalletOverview() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const { data: portfolio, isLoading } = useWalletPortfolio(wallet?.address);

  if (!wallet) {
    return (
      <Card className="mb-4">
        <CardContent>
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="#71717A" />
            <Text className="ml-3 text-sm text-muted-foreground">
              Setting up wallet...
            </Text>
          </View>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="gap-4">
        <Text className="text-xs uppercase tracking-wider text-muted-foreground">
          Total Balance
        </Text>
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color="#71717A"
            className="my-2 self-start"
          />
        ) : (
          <Text className="text-3xl font-bold">
            {portfolio ? formatTotalUsd(portfolio.totalUsd) : "$0.00"}
          </Text>
        )}

        <Text
          className="font-mono text-xs text-muted-foreground"
          numberOfLines={1}
          ellipsizeMode="middle"
          selectable
        >
          {wallet.address}
        </Text>

        <View className="flex-row gap-3">
          <Button
            variant="classic"
            className="flex-1"
            onPress={() =>
              router.push("/(app)/(tabs)/(profile)/deposit" as never)
            }
          >
            <Text className="font-semibold text-primary-foreground">
              Deposit
            </Text>
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onPress={() =>
              router.push("/(app)/(tabs)/(profile)/withdraw" as never)
            }
          >
            <Text className="font-semibold text-secondary-foreground">
              Withdraw
            </Text>
          </Button>
        </View>

        {!isLoading && portfolio && portfolio.items.length > 0 && (
          <ExpandableTokenList items={portfolio.items} />
        )}
      </CardContent>
    </Card>
  );
}
