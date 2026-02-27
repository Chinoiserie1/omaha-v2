import { useState, useEffect, useCallback, memo } from "react";
import { View, ActivityIndicator } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { Ionicons } from "@expo/vector-icons";
import { getConnection, getTokenBalances } from "@repo/solana";
import Toast from "react-native-toast-message";
import { captureError } from "../../lib/capture-error";
import { useInvestorStatus } from "../../hooks/queries/use-investor-status";
import { useClaimRedemption } from "../../hooks/mutations/use-claim-redemption";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

interface VaultInvestmentCardProps {
  vaultId: string;
  mintAddress: string | null;
  onInvest: () => void;
  onWithdraw: () => void;
}

function useShareBalance(
  mintAddress: string | null,
  walletAddress: string | undefined,
) {
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
      const diff = Math.max(
        0,
        targetTimestamp - Math.floor(Date.now() / 1000),
      );
      setRemaining(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { remaining, formatted, isExpired: remaining === 0 };
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function NotInvestedState({ onInvest }: { onInvest: () => void }) {
  return (
    <Card className="mx-5 mt-4">
      <CardHeader>
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Position
        </Text>
      </CardHeader>
      <CardContent className="gap-5">
        <Text className="text-sm leading-5 text-muted-foreground">
          You haven&apos;t invested in this vault yet. Start earning by
          depositing USDC.
        </Text>
        <Button
          onPress={onInvest}
          className="bg-emerald-600 active:bg-emerald-700"
          size="lg"
        >
          <Text className="text-base font-semibold text-white">
            Invest Now
          </Text>
        </Button>
      </CardContent>
    </Card>
  );
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
    <Card className="mx-5 mt-4">
      <CardHeader>
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Position
        </Text>
        {usdValue != null ? (
          <>
            <Text className="text-2xl font-bold text-emerald-400">
              ${formatUsd(usdValue)}
            </Text>
            <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Value
            </Text>
          </>
        ) : (
          <Text className="text-2xl font-bold">
            {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
            shares
          </Text>
        )}
      </CardHeader>
      <CardContent className="gap-5">
        <Separator />
        <View className="flex-row items-baseline">
          <Text className="text-sm font-medium">
            {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </Text>
          <Text className="ml-2 text-xs text-muted-foreground">
            shares
            {sharePrice != null ? ` @ $${formatUsd(sharePrice)}/share` : ""}
          </Text>
        </View>
        <View className="flex-row gap-3">
          <Button
            onPress={onInvest}
            className="flex-1 bg-emerald-600 active:bg-emerald-700"
          >
            <Text className="text-sm font-semibold text-white">
              Invest More
            </Text>
          </Button>
          <Button
            onPress={onWithdraw}
            variant="outline"
            className="flex-1 border-red-600/50"
          >
            <Text className="text-sm font-semibold text-red-400">
              Withdraw
            </Text>
          </Button>
        </View>
      </CardContent>
    </Card>
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
  const pendingUsd = sharePrice != null ? pendingAmount * sharePrice : null;

  return (
    <Card className="mx-5 mt-4">
      <CardHeader>
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Position
        </Text>
      </CardHeader>
      <CardContent className="gap-3">
        {balance !== null && balance > 0 && (
          <View className="mb-1">
            <View className="flex-row items-baseline">
              <Text className="text-lg font-bold">
                {balance.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}
              </Text>
              {remainingUsd != null && (
                <Text className="ml-2 text-xs text-emerald-400">
                  {"\u2248"} ${formatUsd(remainingUsd)}
                </Text>
              )}
            </View>
            <Text className="text-xs text-muted-foreground">
              remaining shares
            </Text>
          </View>
        )}

        <View className="flex-row items-center">
          <View className="mr-2 h-2 w-2 rounded-full bg-amber-500" />
          <Text className="text-sm font-medium text-amber-400">
            Withdrawal Pending
          </Text>
        </View>

        <View className="items-center rounded-xl bg-secondary p-4">
          {canClaim ? (
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text className="ml-2 text-base font-semibold text-emerald-400">
                Ready to claim
              </Text>
            </View>
          ) : (
            <>
              <Text className="font-mono text-2xl font-bold tracking-widest text-amber-400">
                {countdown}
              </Text>
              <Text className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                until claimable
              </Text>
            </>
          )}
        </View>

        <Text className="text-xs text-muted-foreground">
          Redeeming{" "}
          <Text className="font-medium text-foreground">
            {pendingAmount.toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}
          </Text>{" "}
          shares
          {pendingUsd != null && (
            <Text className="text-amber-400">
              {" "}
              {"\u2248"} ${formatUsd(pendingUsd)}
            </Text>
          )}
        </Text>

        <Button
          onPress={onClaim}
          disabled={!canClaim || claimPending}
          className={
            canClaim && !claimPending
              ? "bg-emerald-600 active:bg-emerald-700"
              : "bg-muted"
          }
          size="lg"
        >
          {claimPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={`text-base font-semibold ${canClaim ? "text-white" : "text-muted-foreground"}`}
            >
              Claim Funds
            </Text>
          )}
        </Button>
      </CardContent>
    </Card>
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
      captureError(err, { source: "claim" });
      Toast.show({
        type: "error",
        text1: "Claim Failed",
        text2: err instanceof Error ? err.message : "Transaction failed",
      });
    }
  };

  if (balanceLoading) {
    return (
      <Card className="mx-5 mt-4 items-center">
        <CardContent>
          <ActivityIndicator size="small" color="#71717A" />
        </CardContent>
      </Card>
    );
  }

  const sharePrice = investorStatus?.sharePrice ?? null;

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

  return <NotInvestedState onInvest={onInvest} />;
});
