import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";

const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export function WithdrawForm() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const validateAddress = useCallback((address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleSend = async () => {
    setError(null);

    if (!recipient || !validateAddress(recipient)) {
      setError("Invalid Solana address");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Invalid amount");
      return;
    }

    if (!wallet) {
      setError("Wallet not ready");
      return;
    }

    setSending(true);
    try {
      const connection = new Connection(RPC_URL);
      const fromPubkey = new PublicKey(wallet.address);
      const toPubkey = new PublicKey(recipient);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.round(amountNum * LAMPORTS_PER_SOL),
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      const provider = await wallet.getProvider();
      const result = await provider.request({
        method: "signAndSendTransaction",
        params: {
          transaction,
          connection,
        },
      });

      setTxSignature(result.signature);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSending(false);
    }
  };

  if (txSignature) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
          Sent!
        </Text>
        <Text className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
          Your transaction has been submitted.
        </Text>
        <Text
          className="text-xs text-zinc-500 dark:text-zinc-400 font-mono text-center mb-8"
          numberOfLines={2}
        >
          {txSignature}
        </Text>
        <TouchableOpacity
          className="w-full bg-zinc-900 dark:bg-white py-4 rounded-xl"
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text className="text-white dark:text-zinc-950 text-center font-semibold">Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 px-6 pt-8">
      <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
        Withdraw SOL
      </Text>
      <Text className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Send SOL to another wallet
      </Text>

      <Text className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
        Recipient Address
      </Text>
      <TextInput
        className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-xl px-4 py-3 mb-4 font-mono text-sm"
        value={recipient}
        onChangeText={setRecipient}
        placeholder="Solana address..."
        placeholderTextColor="#71717A"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
        Amount (SOL)
      </Text>
      <TextInput
        className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-xl px-4 py-3 mb-4 text-sm"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        placeholderTextColor="#71717A"
        keyboardType="decimal-pad"
      />

      {error && (
        <Text className="text-red-500 dark:text-red-400 text-sm mb-4">{error}</Text>
      )}

      <TouchableOpacity
        className={`py-4 rounded-xl mt-2 ${sending ? "bg-zinc-400 dark:bg-zinc-600" : "bg-zinc-900 dark:bg-white"}`}
        onPress={handleSend}
        disabled={sending}
        activeOpacity={0.8}
      >
        {sending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white dark:text-zinc-950 text-center font-semibold text-base">
            Send
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="py-3 mt-3"
        onPress={() => router.back()}
        activeOpacity={0.6}
      >
        <Text className="text-zinc-500 dark:text-zinc-400 text-center">Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
