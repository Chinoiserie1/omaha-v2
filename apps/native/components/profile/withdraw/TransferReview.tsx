import { View, ActivityIndicator } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { PortfolioTokenItem } from "@repo/shared";
import { SOL_MINT } from "@repo/solana";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { GlassView } from "@/components/ui/glass";
import { TokenAvatar } from "./TokenAvatar";

interface TransferReviewProps {
  token: PortfolioTokenItem;
  recipient: string;
  amount: string;
  sending: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function TransferReview({
  token,
  recipient,
  amount,
  sending,
  error,
  onBack,
  onConfirm,
}: TransferReviewProps) {
  const amountNum = parseFloat(amount);
  const usdValue = amountNum * token.usdPrice;
  const isNonSol = token.mint !== SOL_MINT;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      className="flex-1 px-6 pt-4"
    >
      <View className="mb-6 flex-row items-center">
        <Button variant="ghost" onPress={onBack} disabled={sending}>
          <Text className="text-base text-primary">Back</Text>
        </Button>
      </View>

      <Text className="mb-6 text-center text-2xl font-bold">Confirm Transfer</Text>

      {/* Summary card */}
      <GlassView className="mb-4 rounded-xl px-5 py-5">
        <View className="items-center">
          <TokenAvatar symbol={token.symbol} size={48} />
          <Text className="mt-3 text-3xl font-bold">
            {amount} {token.symbol}
          </Text>
          {usdValue > 0 && (
            <Text className="mt-1 text-sm text-muted-foreground">
              ~${usdValue.toFixed(2)}
            </Text>
          )}
        </View>
      </GlassView>

      {/* Details */}
      <GlassView className="mb-4 rounded-xl px-5 py-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">To</Text>
          <Text className="font-mono text-sm text-foreground">
            {shortenAddress(recipient)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Network</Text>
          <Text className="text-sm text-foreground">Solana</Text>
        </View>
      </GlassView>

      {/* ATA creation notice for SPL tokens */}
      {isNonSol && (
        <GlassView className="mb-4 rounded-xl px-5 py-3">
          <Text className="text-xs text-muted-foreground">
            If the recipient doesn&apos;t have a token account for {token.symbol}, one
            will be created automatically. A small rent fee (~0.002 SOL) will be
            deducted from your wallet.
          </Text>
        </GlassView>
      )}

      {error && (
        <Text className="mb-3 text-center text-sm text-destructive">
          {error}
        </Text>
      )}

      <View className="mt-auto pb-8">
        <Button
          variant="classic"
          size="lg"
          onPress={onConfirm}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              Confirm & Send
            </Text>
          )}
        </Button>
      </View>
    </Animated.View>
  );
}
