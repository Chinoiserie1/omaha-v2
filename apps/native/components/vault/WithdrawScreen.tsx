import { useState, useEffect, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { getConnection, getTokenBalances } from "@repo/solana";
import Toast from "react-native-toast-message";
import { captureError } from "../../lib/capture-error";
import { useRedeemVault } from "../../hooks/mutations/use-redeem-vault";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

interface WithdrawScreenProps {
  vaultId: string;
  vaultName: string;
  mintAddress: string;
  onClose: () => void;
}

export function WithdrawScreen({
  vaultId,
  vaultName,
  mintAddress,
  onClose,
}: WithdrawScreenProps) {
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const [amount, setAmount] = useState("");
  const [shareBalance, setShareBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const redeemMutation = useRedeemVault();

  const fetchBalance = useCallback(async () => {
    if (!wallet?.address) return;
    setLoadingBalance(true);
    try {
      const connection = getConnection(RPC_URL);
      const tokens = await getTokenBalances(connection, wallet.address);
      const share = tokens.find((t) => t.mint === mintAddress);
      setShareBalance(share?.uiAmount ?? 0);
    } catch {
      setShareBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  }, [wallet?.address, mintAddress]);

  useEffect(() => {
    setAmount("");
    redeemMutation.reset();
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBalance]);

  const amountNum = parseFloat(amount);
  const isValidAmount = !isNaN(amountNum) && amountNum > 0;
  const exceedsBalance =
    isValidAmount && shareBalance !== null && amountNum > shareBalance;

  const handleMax = () => {
    if (shareBalance !== null && shareBalance > 0) {
      setAmount(shareBalance.toString());
    }
  };

  const handleWithdraw = async () => {
    if (!isValidAmount || exceedsBalance || !wallet) return;

    try {
      const provider = await wallet.getProvider();
      const signature = await redeemMutation.mutateAsync({
        vaultId,
        amount: amountNum,
        signerPublicKey: wallet.address,
        signAndSend: (transaction, connection, options) =>
          provider.request({
            method: "signAndSendTransaction",
            params: { transaction, connection, ...(options && { options }) },
          }),
      });

      Toast.show({
        type: "success",
        text1: "Withdrawal Queued",
        text2: `Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
      onClose();
    } catch (err) {
      console.error("[WithdrawScreen] Error:", err);
      captureError(err, { source: "withdraw" });
      Toast.show({
        type: "error",
        text1: "Withdrawal Failed",
        text2: err instanceof Error ? err.message : "Transaction failed",
      });
    }
  };

  const isDisabled =
    !isValidAmount ||
    exceedsBalance ||
    redeemMutation.isPending ||
    !wallet;

  return (
    <View className="flex-1 px-6 pb-10 pt-6">
      <Text className="mb-1 text-xl font-bold">
        Withdraw from {vaultName}
      </Text>
      <Text className="mb-6 text-sm text-muted-foreground">
        Redeem your vault shares
      </Text>

      <View className="mb-2 flex-row items-center justify-between">
        <Label nativeID="share-amount-label">Amount (Shares)</Label>
        <View className="flex-row items-center">
          {loadingBalance ? (
            <ActivityIndicator size="small" color="#71717A" />
          ) : (
            <Text className="text-xs text-muted-foreground">
              Balance:{" "}
              {shareBalance !== null
                ? shareBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })
                : "\u2014"}{" "}
              shares
            </Text>
          )}
          {shareBalance !== null && shareBalance > 0 && (
            <Button variant="ghost" size="sm" onPress={handleMax} className="ml-1">
              <Text className="text-xs font-semibold text-red-400">MAX</Text>
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
        editable={!redeemMutation.isPending}
        aria-labelledby="share-amount-label"
      />

      {exceedsBalance && (
        <Text className="mb-3 text-sm text-destructive">
          Insufficient share balance
        </Text>
      )}

      <Button
        onPress={handleWithdraw}
        disabled={isDisabled}
        className={
          isDisabled
            ? "mt-2 bg-muted"
            : "mt-2 bg-red-600 active:bg-red-700"
        }
        size="lg"
      >
        {redeemMutation.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-base font-semibold text-white">
            {!wallet
              ? "Wallet not ready"
              : !isValidAmount
                ? "Enter amount"
                : exceedsBalance
                  ? "Insufficient balance"
                  : `Withdraw ${amount} shares`}
          </Text>
        )}
      </Button>

      <Button variant="ghost" onPress={onClose} className="mt-2">
        <Text className="text-muted-foreground">Cancel</Text>
      </Button>
    </View>
  );
}
