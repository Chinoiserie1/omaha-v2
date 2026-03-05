import { useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import Toast from "react-native-toast-message";
import { captureError } from "../../lib/capture-error";
import { useShareBalance } from "../../hooks/use-share-balance";
import { useSubscribeVault } from "../../hooks/mutations/use-subscribe-vault";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface InvestScreenProps {
  vaultId: string;
  vaultName: string;
  onClose: () => void;
}

export function InvestScreen({
  vaultId,
  vaultName,
  onClose,
}: InvestScreenProps) {
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const [amount, setAmount] = useState("");

  const {
    balance: usdcBalance,
    loading: loadingBalance,
    refetch: refetchBalance,
  } = useShareBalance(USDC_MINT, wallet?.address);

  const subscribeMutation = useSubscribeVault();

  const amountNum = parseFloat(amount);
  const isValidAmount = !isNaN(amountNum) && amountNum > 0;
  const exceedsBalance =
    isValidAmount && usdcBalance !== null && amountNum > usdcBalance;

  const handleMax = () => {
    if (usdcBalance !== null && usdcBalance > 0) {
      setAmount(usdcBalance.toString());
    }
  };

  const handleInvest = async () => {
    if (!isValidAmount || exceedsBalance || !wallet) return;

    try {
      const provider = await wallet.getProvider();
      const { signature } = await subscribeMutation.mutateAsync({
        vaultId,
        amount: amountNum,
        signerPublicKey: wallet.address,
        signAndSend: (transaction, connection, options) =>
          provider.request({
            method: "signAndSendTransaction",
            params: options
              ? { transaction, connection, options }
              : { transaction, connection },
          }),
      });

      console.log("[InvestScreen] Signature:", signature);

      // Refetch USDC balance (useState-based, not invalidated by React Query)
      refetchBalance();

      Toast.show({
        type: "success",
        text1: "Investment Successful",
        text2: `Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
      onClose();
    } catch (err) {
      console.error("[InvestScreen] Error:", err);
      captureError(err, { source: "invest" });
      Toast.show({
        type: "error",
        text1: "Investment Failed",
        text2: err instanceof Error ? err.message : "Transaction failed",
      });
    }
  };

  const isDisabled =
    !isValidAmount || exceedsBalance || subscribeMutation.isPending || !wallet;

  return (
    <View className="flex-1 px-6 pt-6 pb-10">
      <Text className="mb-1 text-xl font-bold">Invest in {vaultName}</Text>
      <Text className="mb-6 text-sm text-muted-foreground">
        Deposit USDC into this vault
      </Text>

      <View className="flex-row justify-between items-center mb-2">
        <Label nativeID="amount-label">Amount (USDC)</Label>
        <View className="flex-row items-center">
          {loadingBalance ? (
            <ActivityIndicator size="small" color="#94A3B8" />
          ) : (
            <Text className="text-xs text-muted-foreground">
              Balance:{" "}
              {usdcBalance !== null ? usdcBalance.toFixed(2) : "\u2014"} USDC
            </Text>
          )}
          {usdcBalance !== null && usdcBalance > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onPress={handleMax}
              className="ml-1"
            >
              <Text className="text-xs font-semibold text-emerald-500">
                MAX
              </Text>
            </Button>
          )}
        </View>
      </View>

      <Input
        className="mb-3 text-lg"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        placeholderTextColor="#94A3B8"
        keyboardType="decimal-pad"
        editable={!subscribeMutation.isPending}
        aria-labelledby="amount-label"
      />

      {exceedsBalance && (
        <Text className="mb-3 text-sm text-destructive">
          Insufficient USDC balance
        </Text>
      )}

      <Button
        variant="classic"
        onPress={handleInvest}
        disabled={isDisabled}
        className={
          isDisabled
            ? "mt-2 bg-muted"
            : "mt-2 bg-emerald-600 active:bg-emerald-700"
        }
        size="lg"
      >
        {subscribeMutation.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-semibold text-foreground">
            {!wallet
              ? "Wallet not ready"
              : !isValidAmount
                ? "Enter amount"
                : exceedsBalance
                  ? "Insufficient balance"
                  : `Invest ${amount} USDC`}
          </Text>
        )}
      </Button>

      <Button variant="ghost" onPress={onClose} className="mt-2">
        <Text className="text-muted-foreground">Cancel</Text>
      </Button>
    </View>
  );
}
