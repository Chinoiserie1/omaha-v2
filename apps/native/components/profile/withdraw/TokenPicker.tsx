import { FlatList, Pressable, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { PortfolioTokenItem } from "@repo/shared";
import { Text } from "@/components/ui/text";
import { GlassView } from "@/components/ui/glass";
import { TokenAvatar } from "./TokenAvatar";

interface TokenPickerProps {
  tokens: PortfolioTokenItem[];
  onSelect: (token: PortfolioTokenItem) => void;
  onBack: () => void;
}

function formatUsd(value: number): string {
  if (value >= 1_000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  return value > 0 ? "<$0.01" : "$0.00";
}

function formatBalance(amount: number, symbol: string): string {
  if (amount >= 1_000) return `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`;
  return `${amount.toFixed(Math.min(6, Math.max(2, -Math.floor(Math.log10(amount || 1)))))} ${symbol}`;
}

export function TokenPicker({ tokens, onSelect, onBack }: TokenPickerProps) {
  return (
    <View className="flex-1 px-6 pt-4">
      <View className="mb-6">
        <Pressable onPress={onBack} hitSlop={12} className="mb-4">
          <Text className="text-base text-primary">Cancel</Text>
        </Pressable>
        <Text className="mb-1 text-2xl font-bold">Select Token</Text>
        <Text className="text-sm text-muted-foreground">
          Choose which token to send
        </Text>
      </View>

      <FlatList
        data={tokens}
        keyExtractor={(item) => item.mint}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(200)}>
            <GlassView className="mb-2 rounded-xl">
              <Pressable
                onPress={() => onSelect(item)}
                className="flex-row items-center px-4"
                style={{ height: 56 }}
              >
                <TokenAvatar symbol={item.symbol} size={36} />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {item.symbol}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-semibold text-foreground">
                    {formatUsd(item.valueUsd)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {formatBalance(item.amount, item.symbol)}
                  </Text>
                </View>
              </Pressable>
            </GlassView>
          </Animated.View>
        )}
      />
    </View>
  );
}
