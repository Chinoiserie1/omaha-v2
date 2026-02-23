import { View, Text } from "react-native";
import type { TokenBalance } from "@repo/solana";

interface TokenListProps {
  tokens: TokenBalance[];
}

function shortenMint(mint: string): string {
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

export function TokenList({ tokens }: TokenListProps) {
  return (
    <View className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
      <Text className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
        Tokens
      </Text>
      {tokens.map((token) => (
        <View
          key={token.mint}
          className="flex-row items-center justify-between py-2 border-b border-zinc-200/50 dark:border-zinc-800/50"
        >
          <View className="flex-1">
            <Text
              className="text-xs text-zinc-500 dark:text-zinc-400 font-mono"
              numberOfLines={1}
            >
              {shortenMint(token.mint)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-sm font-semibold text-zinc-900 dark:text-white">
              {token.uiAmount.toLocaleString(undefined, {
                maximumFractionDigits: token.decimals > 4 ? 4 : token.decimals,
              })}
            </Text>
            <Text className="text-xs text-zinc-500 dark:text-zinc-400">
              {token.decimals}d
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
