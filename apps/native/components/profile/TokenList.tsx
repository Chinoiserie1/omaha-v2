import { View } from "react-native";
import type { TokenBalance } from "@repo/solana";
import { Text } from "@/components/ui/text";
import { Separator } from "@/components/ui/separator";

interface TokenListProps {
  tokens: TokenBalance[];
}

function shortenMint(mint: string): string {
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

export function TokenList({ tokens }: TokenListProps) {
  return (
    <View className="pt-3">
      <Separator className="mb-3" />
      <Text className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Tokens
      </Text>
      {tokens.map((token) => (
        <View
          key={token.mint}
          className="flex-row items-center justify-between border-b border-border/50 py-2"
        >
          <View className="flex-1">
            <Text
              className="font-mono text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {shortenMint(token.mint)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-sm font-semibold">
              {token.uiAmount.toLocaleString(undefined, {
                maximumFractionDigits: token.decimals > 4 ? 4 : token.decimals,
              })}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {token.decimals}d
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
