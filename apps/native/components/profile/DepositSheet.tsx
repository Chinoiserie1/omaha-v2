import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { AlertTriangle } from "lucide-react-native";
import { GlassView } from "@/components/ui/glass";

export function DepositSheet() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!wallet?.address) return;
    await Clipboard.setStringAsync(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!wallet) return null;

  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-xl font-bold text-foreground mb-2">
        Deposit USDC
      </Text>
      <Text className="text-sm text-muted-foreground mb-4 text-center">
        Send USDC to your wallet address below
      </Text>

      <GlassView className="mb-6 w-full rounded-xl px-4 py-3">
        <View className="flex-row items-start gap-2">
          <AlertTriangle size={16} color="#f59e0b" className="mt-0.5" />
          <Text className="flex-1 text-xs text-amber-400">
            Only send USDC (SPL) to this address. Sending other tokens may
            result in loss of funds.
          </Text>
        </View>
      </GlassView>

      <View className="bg-secondary p-6 rounded-2xl mb-6">
        <QRCode
          value={wallet.address}
          size={200}
          backgroundColor="transparent"
          color="#F8FAFC"
        />
      </View>

      <TouchableOpacity
        className="w-full bg-card rounded-xl p-4 mb-4"
        onPress={handleCopy}
        activeOpacity={0.7}
      >
        <Text
          className="text-sm text-muted-foreground font-mono text-center"
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {wallet.address}
        </Text>
        <Text className="text-xs text-muted-foreground text-center mt-1">
          {copied ? "Copied!" : "Tap to copy"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="w-full bg-white py-4 rounded-xl mt-4"
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Text className="text-background text-center font-semibold text-base">
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );
}
