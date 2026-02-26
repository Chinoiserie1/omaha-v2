import { useState, useEffect, useCallback, memo } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { Ionicons } from "@expo/vector-icons";
import { getConnection, getTokenBalances } from "@repo/solana";
import Toast from "react-native-toast-message";
import { useInvestorStatus } from "../../hooks/queries/use-investor-status";
import { useClaimRedemption } from "../../hooks/mutations/use-claim-redemption";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

interface VaultInvestmentCardProps {
  vaultId: string;
  mintAddress: string | null;
  onInvest: () => void;
  onWithdraw: () => void;
}

function useShareBalance(mintAddress: string | null, walletAddress: string | undefined) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress || !mintAddress) {
      setBalance(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const connection = getConnection(RPC_URL);
      const tokens = await getTokenBalances(connection, walletAddress);
      const share = tokens.find((t) => t.mint === mintAddress);
      setBalance(share?.uiAmount ?? 0);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, mintAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, refetch: fetchBalance };
}

function useCountdown(targetTimestamp: number | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!targetTimestamp) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, targetTimestamp - Math.floor(Date.now() / 1000));
      setRemaining(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const formatted =
    `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { remaining, formatted, isExpired: remaining === 0 };
}

function NotInvestedState({ onInvest }: { onInvest: () => void }) {
  return (
    <View className="mx-5 mt-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
        Your Position
      </Text>
      <Text className="text-sm text-zinc-600 dark:text-zinc-400 mb-5 leading-5">
        You haven&apos;t invested in this vault yet. Start earning by depositing
        USDC.
      </Text>
      <Pressable
        onPress={onInvest}
        className="py-4 rounded-xl items-center bg-emerald-600 active:bg-emerald-700"
      >
        <Text className="text-white font-semibold text-base">Invest Now</Text>
      </Pressable>
    </View>
  );
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function InvestedState({
  balance,
  sharePrice,
  onInvest,
  onWithdraw,
}: {
  balance: number;
  sharePrice: number | null;
  onInvest: () => void;
  onWithdraw: () => void;
}) {
  const usdValue = sharePrice != null ? balance * sharePrice : null;

  return (
    <View className="mx-5 mt-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
        Your Position
      </Text>
      {usdValue != null ? (
        <>
          <Text className="text-2xl font-bold text-emerald-400">
            ${formatUsd(usdValue)}
          </Text>
          <Text className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 mb-4">
            Total Value
          </Text>
        </>
      ) : (
        <Text className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
          {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} shares
        </Text>
      )}
      <View className="h-px bg-zinc-200 dark:bg-zinc-800 mb-3" />
      <View className="flex-row items-baseline mb-5">
        <Text className="text-sm font-medium text-zinc-900 dark:text-white">
          {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
        </Text>
        <Text className="text-xs text-zinc-500 ml-2">
          shares{sharePrice != null ? ` @ $${formatUsd(sharePrice)}/share` : ""}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <Pressable
          onPress={onInvest}
          className="flex-1 py-3.5 rounded-xl items-center bg-emerald-600 active:bg-emerald-700"
        >
          <Text className="text-white font-semibold text-sm">Invest More</Text>
        </Pressable>
        <Pressable
          onPress={onWithdraw}
          className="flex-1 py-3.5 rounded-xl items-center bg-zinc-200 dark:bg-zinc-800 border border-red-600/50 active:bg-zinc-300 dark:active:bg-zinc-700"
        >
          <Text className="text-red-400 font-semibold text-sm">Withdraw</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PendingWithdrawalState({
  balance,
  pendingAmount,
  sharePrice,
  countdown,
  canClaim,
  claimPending,
  onClaim,
}: {
  balance: number | null;
  pendingAmount: number;
  sharePrice: number | null;
  countdown: string;
  canClaim: boolean;
  claimPending: boolean;
  onClaim: () => void;
}) {
  const remainingUsd =
    balance != null && sharePrice != null ? balance * sharePrice : null;
  const pendingUsd =
    sharePrice != null ? pendingAmount * sharePrice : null;

  return (
    <View className="mx-5 mt-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
        Your Position
      </Text>

      {balance !== null && balance > 0 && (
        <View className="mb-3">
          <View className="flex-row items-baseline">
            <Text className="text-lg font-bold text-zinc-900 dark:text-white">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </Text>
            {remainingUsd != null && (
              <Text className="text-xs text-emerald-400 ml-2">
                {"\u2248"} ${formatUsd(remainingUsd)}
              </Text>
            )}
          </View>
          <Text className="text-xs text-zinc-500">remaining shares</Text>
        </View>
      )}

      <View className="flex-row items-center mb-3">
        <View className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
        <Text className="text-sm font-medium text-amber-400">
          Withdrawal Pending
        </Text>
      </View>

      <View className="bg-zinc-200 dark:bg-zinc-800 rounded-xl p-4 items-center mb-4">
        {canClaim ? (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text className="text-base font-semibold text-emerald-400 ml-2">
              Ready to claim
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-2xl font-bold text-amber-400 font-mono tracking-widest">
              {countdown}
            </Text>
            <Text className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">
              until claimable
            </Text>
          </>
        )}
      </View>

      <Text className="text-xs text-zinc-500 mb-4">
        Redeeming{" "}
        <Text className="text-zinc-700 dark:text-zinc-300 font-medium">
          {pendingAmount.toLocaleString(undefined, {
            maximumFractionDigits: 6,
          })}
        </Text>{" "}
        shares
        {pendingUsd != null && (
          <Text className="text-amber-400">
            {" "}{"\u2248"} ${formatUsd(pendingUsd)}
          </Text>
        )}
      </Text>

      <Pressable
        onPress={onClaim}
        disabled={!canClaim || claimPending}
        className={`py-4 rounded-xl items-center ${
          canClaim && !claimPending
            ? "bg-emerald-600 active:bg-emerald-700"
            : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        {claimPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text
            className={`font-semibold text-base ${canClaim ? "text-white" : "text-zinc-500"}`}
          >
            Claim Funds
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export const VaultInvestmentCard = memo(function VaultInvestmentCard({
  vaultId,
  mintAddress,
  onInvest,
  onWithdraw,
}: VaultInvestmentCardProps) {
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const { balance, loading: balanceLoading } = useShareBalance(
    mintAddress,
    wallet?.address,
  );

  const { data: investorStatus } = useInvestorStatus(vaultId, wallet?.address);

  const claimMutation = useClaimRedemption();

  const pendingRequest = investorStatus?.pendingRequest;
  const redeemNoticePeriod = investorStatus?.redeemNoticePeriod ?? 0;

  const claimableAt = pendingRequest
    ? pendingRequest.createdAt + redeemNoticePeriod
    : null;

  const { formatted, isExpired } = useCountdown(claimableAt);

  const handleClaim = async () => {
    if (!wallet) return;
    try {
      const provider = await wallet.getProvider();
      const signature = await claimMutation.mutateAsync({
        vaultId,
        signerPublicKey: wallet.address,
        signAndSend: (transaction, connection, options) =>
          provider.request({
            method: "signAndSendTransaction",
            params: { transaction, connection, ...(options && { options }) },
          }),
      });

      Toast.show({
        type: "success",
        text1: "Claim Successful",
        text2: `Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Claim Failed",
        text2: err instanceof Error ? err.message : "Transaction failed",
      });
    }
  };

  if (balanceLoading) {
    return (
      <View className="mx-5 mt-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 items-center">
        <ActivityIndicator size="small" color="#71717A" />
      </View>
    );
  }

  const sharePrice = investorStatus?.sharePrice ?? null;

  // State 3: Pending withdrawal
  if (pendingRequest?.type === "REDEMPTION") {
    return (
      <PendingWithdrawalState
        balance={balance}
        pendingAmount={pendingRequest.amount}
        sharePrice={sharePrice}
        countdown={formatted}
        canClaim={isExpired}
        claimPending={claimMutation.isPending}
        onClaim={handleClaim}
      />
    );
  }

  // State 2: Invested
  if (balance && balance > 0) {
    return (
      <InvestedState
        balance={balance}
        sharePrice={sharePrice}
        onInvest={onInvest}
        onWithdraw={onWithdraw}
      />
    );
  }

  // State 1: Not invested
  return <NotInvestedState onInvest={onInvest} />;
});
