import { useState } from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { AlertTriangle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { GlassView } from "@/components/ui/glass";
import { useFundSol } from "../../../hooks/mutations/use-fund-sol";
import { AmountPicker } from "./AmountPicker";
import { FundSolSuccess } from "./FundSolSuccess";

export function FundSolSheet() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const fundSol = useFundSol();
  const [selectedAmount, setSelectedAmount] = useState(1);

  if (!wallet) return null;

  if (fundSol.isSuccess) {
    return <FundSolSuccess signature={fundSol.data.signature} />;
  }

  const handleSwap = async () => {
    const provider = await wallet.getProvider();
    await fundSol.mutateAsync({
      amountUsd: selectedAmount,
      signerPublicKey: wallet.address,
      signAndSend: (transaction, connection, options) =>
        provider.request({
          method: "signAndSendTransaction",
          params: options
            ? { transaction, connection, options }
            : { transaction, connection },
        }),
    });
  };

  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-xl font-bold text-foreground mb-2">
        Fund SOL
      </Text>
      <Text className="text-sm text-muted-foreground mb-6 text-center">
        Swap a small amount of USDC to SOL for transaction fees
      </Text>

      <GlassView className="mb-6 w-full rounded-xl px-4 py-3">
        <View className="flex-row items-start gap-2">
          <AlertTriangle size={16} color="#f59e0b" className="mt-0.5" />
          <Text className="flex-1 text-xs text-amber-400">
            SOL is needed to pay blockchain transaction fees. A small amount of
            your USDC will be swapped to SOL. A 2% platform fee applies.
          </Text>
        </View>
      </GlassView>

      <Text className="text-sm text-muted-foreground mb-3">
        Select amount
      </Text>

      <AmountPicker selected={selectedAmount} onSelect={setSelectedAmount} />

      {fundSol.isError && (
        <Text className="mt-4 text-xs text-red-400 text-center">
          {fundSol.error?.message ?? "Something went wrong. Please try again."}
        </Text>
      )}

      <TouchableOpacity
        className={`mt-8 w-full py-4 rounded-xl ${
          fundSol.isPending ? "bg-white/70" : "bg-white"
        }`}
        onPress={handleSwap}
        disabled={fundSol.isPending}
        activeOpacity={0.8}
      >
        {fundSol.isPending ? (
          <ActivityIndicator color="#0F172A" />
        ) : (
          <Text className="text-background text-center font-semibold text-base">
            Swap ${selectedAmount} USDC to SOL
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="mt-4 w-full py-3"
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Text className="text-muted-foreground text-center text-sm">
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  );
}
