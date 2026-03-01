import { useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import Toast from "react-native-toast-message";
import { captureError } from "../../lib/capture-error";
import { useShareBalance } from "../../hooks/use-share-balance";
import { useRequestWithdrawal } from "../../hooks/mutations/use-request-withdrawal";
import { useWithdrawalStatus } from "../../hooks/queries/use-withdrawals";
import { WithdrawalTimeline } from "./WithdrawalTimeline";
import { WithdrawalClaimCard } from "./WithdrawalClaimCard";
import { WithdrawalFailedCard } from "./WithdrawalFailedCard";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_RETRIES = 3;

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
  const [activeWithdrawalId, setActiveWithdrawalId] = useState<
    string | undefined
  >();

  const { balance: shareBalance, loading: loadingBalance } = useShareBalance(
    mintAddress,
    wallet?.address,
  );

  const requestMutation = useRequestWithdrawal();
  const { data: activeWithdrawal } = useWithdrawalStatus(activeWithdrawalId);

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

    const provider = await wallet.getProvider();
    if (!provider) return;

    try {
      const result = await requestMutation.mutateAsync({
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

      setActiveWithdrawalId(result.withdrawalId);

      Toast.show({
        type: "success",
        text1: "Withdrawal Submitted",
        text2: "Your redeem transaction is being processed",
      });
    } catch (err) {
      console.error("[WithdrawScreen] Error:", err);
      captureError(err, { source: "withdraw-request" });
      Toast.show({
        type: "error",
        text1: "Request Failed",
        text2: err instanceof Error ? err.message : "Could not submit withdrawal",
      });
    }
  };

  // Show timeline + action cards when there's an active withdrawal
  if (activeWithdrawal) {
    return (
      <View className="flex-1 pb-10 pt-6">
        <View className="px-6">
          <Text className="mb-1 text-xl font-bold">
            Withdraw from {vaultName}
          </Text>
          <Text className="mb-2 text-sm text-muted-foreground">
            {activeWithdrawal.amount.toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}{" "}
            shares
          </Text>
        </View>

        <WithdrawalTimeline
          status={activeWithdrawal.status}
          requestedAt={activeWithdrawal.requestedAt}
          processingAt={activeWithdrawal.processingAt}
          claimableAt={activeWithdrawal.claimableAt}
          claimedAt={activeWithdrawal.claimedAt}
          failedAt={activeWithdrawal.failedAt}
          errorMessage={activeWithdrawal.errorMessage}
          estimatedFulfillAt={activeWithdrawal.estimatedFulfillAt}
        />

        {activeWithdrawal.status === "CLAIMABLE" && (
          <WithdrawalClaimCard withdrawal={activeWithdrawal} />
        )}

        {activeWithdrawal.status === "FAILED" && (
          <WithdrawalFailedCard
            withdrawal={activeWithdrawal}
            maxRetries={MAX_RETRIES}
          />
        )}

        {activeWithdrawal.status === "CLAIMED" && (
          <View className="mx-5 mt-4">
            <Button variant="classic" onPress={onClose} size="lg">
              <Text className="text-base font-semibold text-white">Done</Text>
            </Button>
          </View>
        )}

        <View className="px-6">
          <Button variant="ghost" onPress={onClose} className="mt-2">
            <Text className="text-muted-foreground">Close</Text>
          </Button>
        </View>
      </View>
    );
  }

  // Request form (initial state)
  const isDisabled =
    !isValidAmount ||
    exceedsBalance ||
    requestMutation.isPending ||
    !wallet;

  return (
    <View className="flex-1 px-6 pb-10 pt-6">
      <Text className="mb-1 text-xl font-bold">
        Withdraw from {vaultName}
      </Text>
      <Text className="mb-6 text-sm text-muted-foreground">
        Request a withdrawal from the vault
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
        editable={!requestMutation.isPending}
        aria-labelledby="share-amount-label"
      />

      {exceedsBalance && (
        <Text className="mb-3 text-sm text-destructive">
          Insufficient share balance
        </Text>
      )}

      <Button
        variant="classic"
        onPress={handleWithdraw}
        disabled={isDisabled}
        className={
          isDisabled
            ? "mt-2 bg-muted"
            : "mt-2 bg-red-600 active:bg-red-700"
        }
        size="lg"
      >
        {requestMutation.isPending ? (
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
