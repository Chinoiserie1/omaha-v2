import { useState, useEffect, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { getConnection, getTokenBalances } from "@repo/solana";
import Toast from "react-native-toast-message";
import { captureError } from "../../lib/capture-error";
import { useSubscribeVault } from "../../hooks/mutations/use-subscribe-vault";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

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
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const subscribeMutation = useSubscribeVault();

  const fetchBalance = useCallback(async () => {
    if (!wallet?.address) return;
    setLoadingBalance(true);
    try {
      const connection = getConnection(RPC_URL);
      const tokens = await getTokenBalances(connection, wallet.address);
      const usdc = tokens.find((t) => t.mint === USDC_MINT);
      setUsdcBalance(usdc?.uiAmount ?? 0);
    } catch {
      setUsdcBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  }, [wallet?.address]);

  useEffect(() => {
    setAmount("");
    subscribeMutation.reset();
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBalance]);

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
      const signature = await subscribeMutation.mutateAsync({
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
    !isValidAmount ||
    exceedsBalance ||
    subscribeMutation.isPending ||
    !wallet;

  return (
    <View className="flex-1 px-6 pb-10 pt-6">
      <Text className="mb-1 text-xl font-bold">Invest in {vaultName}</Text>
      <Text className="mb-6 text-sm text-muted-foreground">
        Deposit USDC into this vault
      </Text>

      <View className="mb-2 flex-row items-center justify-between">
        <Label nativeID="amount-label">Amount (USDC)</Label>
        <View className="flex-row items-center">
          {loadingBalance ? (
            <ActivityIndicator size="small" color="#71717A" />
          ) : (
            <Text className="text-xs text-muted-foreground">
              Balance:{" "}
              {usdcBalance !== null ? usdcBalance.toFixed(2) : "\u2014"} USDC
            </Text>
          )}
          {usdcBalance !== null && usdcBalance > 0 && (
            <Button variant="ghost" size="sm" onPress={handleMax} className="ml-1">
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
        placeholderTextColor="#A1A1AA"
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
          <Text className="text-base font-semibold text-white">
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
