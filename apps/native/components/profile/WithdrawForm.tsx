import { useState, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { captureError } from "../../lib/capture-error";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

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
        }),
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
      captureError(err, { source: "send_sol" });
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSending(false);
    }
  };

  if (txSignature) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="mb-2 text-xl font-bold">Sent!</Text>
        <Text className="mb-6 text-center text-sm text-muted-foreground">
          Your transaction has been submitted.
        </Text>
        <Text
          className="mb-8 text-center font-mono text-xs text-muted-foreground"
          numberOfLines={2}
        >
          {txSignature}
        </Text>
        <Button variant="classic" className="w-full" size="lg" onPress={() => router.back()}>
          <Text className="font-semibold text-primary-foreground">Done</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 px-6 pt-8">
      <Text className="mb-2 text-xl font-bold">Withdraw SOL</Text>
      <Text className="mb-8 text-sm text-muted-foreground">
        Send SOL to another wallet
      </Text>

      <Label nativeID="recipient-label" className="mb-2">
        Recipient Address
      </Label>
      <Input
        className="mb-4 font-mono text-sm"
        value={recipient}
        onChangeText={setRecipient}
        placeholder="Solana address..."
        placeholderTextColor="#71717A"
        autoCapitalize="none"
        autoCorrect={false}
        aria-labelledby="recipient-label"
      />

      <Label nativeID="sol-amount-label" className="mb-2">
        Amount (SOL)
      </Label>
      <Input
        className="mb-4 text-sm"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        placeholderTextColor="#71717A"
        keyboardType="decimal-pad"
        aria-labelledby="sol-amount-label"
      />

      {error && (
        <Text className="mb-4 text-sm text-destructive">{error}</Text>
      )}

      <Button
        variant="classic"
        className="mt-2"
        onPress={handleSend}
        disabled={sending}
        size="lg"
      >
        {sending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-semibold text-primary-foreground">
            Send
          </Text>
        )}
      </Button>

      <Button
        variant="ghost"
        className="mt-3"
        onPress={() => router.back()}
      >
        <Text className="text-muted-foreground">Cancel</Text>
      </Button>
    </View>
  );
}
