import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";

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
      <Text className="text-xl font-bold text-white mb-2">
        Deposit SOL
      </Text>
      <Text className="text-sm text-zinc-400 mb-8 text-center">
        Send SOL to your wallet address below
      </Text>

      <View className="bg-zinc-800 p-6 rounded-2xl mb-6">
        <QRCode
          value={wallet.address}
          size={200}
          backgroundColor="transparent"
          color="#FAFAFA"
        />
      </View>

      <TouchableOpacity
        className="w-full bg-zinc-900 rounded-xl p-4 mb-4"
        onPress={handleCopy}
        activeOpacity={0.7}
      >
        <Text
          className="text-sm text-zinc-300 font-mono text-center"
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {wallet.address}
        </Text>
        <Text className="text-xs text-zinc-400 text-center mt-1">
          {copied ? "Copied!" : "Tap to copy"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="w-full bg-white py-4 rounded-xl mt-4"
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Text className="text-zinc-950 text-center font-semibold text-base">
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );
}
