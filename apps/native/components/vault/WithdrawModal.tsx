import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { getConnection, getTokenBalances } from "@repo/solana";
import Toast from "react-native-toast-message";
import { useRedeemVault } from "../../hooks/mutations/use-redeem-vault";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

interface WithdrawModalProps {
  visible: boolean;
  onClose: () => void;
  vaultId: string;
  vaultName: string;
  mintAddress: string;
}

export function WithdrawModal({
  visible,
  onClose,
  vaultId,
  vaultName,
  mintAddress,
}: WithdrawModalProps) {
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
    if (visible) {
      setAmount("");
      redeemMutation.reset();
      fetchBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fetchBalance]);

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
      console.error("[WithdrawModal] Error:", err);
      Toast.show({
        type: "error",
        text1: "Withdrawal Failed",
        text2: err instanceof Error ? err.message : "Transaction failed",
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-end"
      >
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-zinc-900 rounded-t-3xl px-6 pt-6 pb-10">
          <View className="w-10 h-1 bg-zinc-700 rounded-full self-center mb-6" />

          <Text className="text-xl font-bold text-white mb-1">
            Withdraw from {vaultName}
          </Text>
          <Text className="text-sm text-zinc-400 mb-6">
            Redeem your vault shares
          </Text>

          {/* Balance display */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs text-zinc-500 uppercase tracking-wider">
              Amount (Shares)
            </Text>
            <View className="flex-row items-center">
              {loadingBalance ? (
                <ActivityIndicator size="small" color="#71717A" />
              ) : (
                <Text className="text-xs text-zinc-500">
                  Balance:{" "}
                  {shareBalance !== null
                    ? shareBalance.toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })
                    : "—"}{" "}
                  shares
                </Text>
              )}
              {shareBalance !== null && shareBalance > 0 && (
                <Pressable onPress={handleMax} className="ml-2">
                  <Text className="text-xs font-semibold text-red-400">
                    MAX
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Amount input */}
          <TextInput
            className="bg-zinc-800 text-white text-lg rounded-xl px-4 py-3 mb-3"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#52525B"
            keyboardType="decimal-pad"
            editable={!redeemMutation.isPending}
          />

          {/* Validation error */}
          {exceedsBalance && (
            <Text className="text-red-400 text-sm mb-3">
              Insufficient share balance
            </Text>
          )}

          {/* Withdraw button */}
          <Pressable
            onPress={handleWithdraw}
            disabled={
              !isValidAmount ||
              exceedsBalance ||
              redeemMutation.isPending ||
              !wallet
            }
            className={`py-4 rounded-xl mt-2 items-center ${
              !isValidAmount ||
              exceedsBalance ||
              redeemMutation.isPending ||
              !wallet
                ? "bg-zinc-700"
                : "bg-red-600 active:bg-red-700"
            }`}
          >
            {redeemMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {!wallet
                  ? "Wallet not ready"
                  : !isValidAmount
                    ? "Enter amount"
                    : exceedsBalance
                      ? "Insufficient balance"
                      : `Withdraw ${amount} shares`}
              </Text>
            )}
          </Pressable>

          {/* Cancel button */}
          <Pressable onPress={onClose} className="py-3 mt-2">
            <Text className="text-zinc-500 text-center">Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
