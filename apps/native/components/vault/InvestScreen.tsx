import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { getConnection, getTokenBalances } from "@repo/solana";
import Toast from "react-native-toast-message";
import { captureError } from "../../lib/capture-error";
import { useSubscribeVault } from "../../hooks/mutations/use-subscribe-vault";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface InvestScreenProps {
  vaultId: string;
  vaultName: string;
  onClose: () => void;
}

export function InvestScreen({ vaultId, vaultName, onClose }: InvestScreenProps) {
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

  return (
    <View className="flex-1 px-6 pt-6 pb-10">
      <Text className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
        Invest in {vaultName}
      </Text>
      <Text className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        Deposit USDC into this vault
      </Text>

      {/* Balance display */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs text-zinc-500 uppercase tracking-wider">
          Amount (USDC)
        </Text>
        <View className="flex-row items-center">
          {loadingBalance ? (
            <ActivityIndicator size="small" color="#71717A" />
          ) : (
            <Text className="text-xs text-zinc-500">
              Balance: {usdcBalance !== null ? usdcBalance.toFixed(2) : "—"}{" "}
              USDC
            </Text>
          )}
          {usdcBalance !== null && usdcBalance > 0 && (
            <Pressable onPress={handleMax} className="ml-2">
              <Text className="text-xs font-semibold text-emerald-500">
                MAX
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Amount input */}
      <TextInput
        className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-lg rounded-xl px-4 py-3 mb-3"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        placeholderTextColor="#A1A1AA"
        keyboardType="decimal-pad"
        editable={!subscribeMutation.isPending}
      />

      {/* Validation error */}
      {exceedsBalance && (
        <Text className="text-red-400 text-sm mb-3">
          Insufficient USDC balance
        </Text>
      )}

      {/* Invest button */}
      <Pressable
        onPress={handleInvest}
        disabled={
          !isValidAmount ||
          exceedsBalance ||
          subscribeMutation.isPending ||
          !wallet
        }
        className={`py-4 rounded-xl mt-2 items-center ${
          !isValidAmount ||
          exceedsBalance ||
          subscribeMutation.isPending ||
          !wallet
            ? "bg-zinc-300 dark:bg-zinc-700"
            : "bg-emerald-600 active:bg-emerald-700"
        }`}
      >
        {subscribeMutation.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-semibold text-base">
            {!wallet
              ? "Wallet not ready"
              : !isValidAmount
                ? "Enter amount"
                : exceedsBalance
                  ? "Insufficient balance"
                  : `Invest ${amount} USDC`}
          </Text>
        )}
      </Pressable>

      {/* Cancel button */}
      <Pressable onPress={onClose} className="py-3 mt-2">
        <Text className="text-zinc-500 text-center">Cancel</Text>
      </Pressable>
    </View>
  );
}
