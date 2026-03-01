import { useState } from "react";
import { View, Pressable } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { PortfolioTokenItem } from "@repo/shared";
import { SOL_MINT } from "@repo/solana";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassView } from "@/components/ui/glass";
import { TokenAvatar } from "./TokenAvatar";

interface TransferFormProps {
  token: PortfolioTokenItem;
  onBack: () => void;
  onContinue: (recipient: string, amount: string) => void;
}

const SOL_FEE_RESERVE = 0.001;

export function TransferForm({ token, onBack, onContinue }: TransferFormProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const maxAmount =
    token.mint === SOL_MINT
      ? Math.max(0, token.amount - SOL_FEE_RESERVE)
      : token.amount;

  const usdEquivalent = token.usdPrice * (parseFloat(amount) || 0);

  const handleMax = () => {
    setAmount(maxAmount > 0 ? String(maxAmount) : "0");
  };

  const handleContinue = () => {
    setError(null);
    if (!recipient.trim()) {
      setError("Enter a recipient address");
      return;
    }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (parsed > token.amount) {
      setError("Insufficient balance");
      return;
    }
    onContinue(recipient.trim(), amount);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      className="flex-1 px-6 pt-4"
    >
      <View className="mb-6 flex-row items-center">
        <Pressable onPress={onBack} hitSlop={12}>
          <Text className="text-base text-primary">Back</Text>
        </Pressable>
      </View>

      {/* Token badge */}
      <View className="mb-6 items-center">
        <TokenAvatar symbol={token.symbol} size={48} />
        <Text className="mt-2 text-sm font-medium text-muted-foreground">
          Sending {token.symbol}
        </Text>
      </View>

      {/* Amount input */}
      <GlassView className="mb-4 items-center rounded-xl px-6 py-5">
        <View className="flex-row items-center">
          <Input
            className="h-auto flex-1 border-0 bg-transparent py-2 text-center text-4xl font-bold leading-tight"
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor="#64748B"
            keyboardType="decimal-pad"
          />
          <Text className="ml-1 text-xl font-semibold text-muted-foreground">
            {token.symbol}
          </Text>
        </View>
        {usdEquivalent > 0 && (
          <Text className="mt-1 text-sm text-muted-foreground">
            ~${usdEquivalent.toFixed(2)}
          </Text>
        )}
        <Pressable
          onPress={handleMax}
          className="mt-3 rounded-full bg-secondary px-4 py-1.5"
        >
          <Text className="text-xs font-semibold text-muted-foreground">
            Max: {maxAmount.toFixed(token.mint === SOL_MINT ? 4 : 6)} {token.symbol}
          </Text>
        </Pressable>
      </GlassView>

      {/* Recipient input */}
      <GlassView className="mb-4 rounded-xl px-4 py-4">
        <Text className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Recipient
        </Text>
        <Input
          className="border-0 bg-transparent font-mono text-sm"
          value={recipient}
          onChangeText={setRecipient}
          placeholder="Solana address..."
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </GlassView>

      {error && (
        <Text className="mb-3 text-center text-sm text-destructive">
          {error}
        </Text>
      )}

      <View className="mt-auto pb-8">
        <Button variant="classic" size="lg" onPress={handleContinue}>
          <Text className="text-base font-semibold text-primary-foreground">
            Review
          </Text>
        </Button>
      </View>
    </Animated.View>
  );
}
