import { useEffect, memo } from "react";
import { View, ActivityIndicator } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import Toast from "react-native-toast-message";
import { captureError } from "../../lib/capture-error";
import { useShareBalance } from "../../hooks/use-share-balance";
import { useInvestorStatus } from "../../hooks/queries/use-investor-status";
import { useReconcileWithdrawal } from "../../hooks/mutations/use-reconcile-withdrawal";
import { useWithdrawals } from "../../hooks/queries/use-withdrawals";
import { useClaimWithdrawal } from "../../hooks/mutations/use-claim-withdrawal";
import type { WithdrawalRequest } from "@repo/shared";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatUsd } from "../../lib/format";

interface VaultInvestmentCardProps {
  vaultId: string;
  mintAddress: string | null;
  onInvest: () => void;
  onWithdraw: () => void;
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
          variant="classic"
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
              {formatUsd(usdValue)}
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
            {sharePrice != null ? ` @ ${formatUsd(sharePrice)}/share` : ""}
          </Text>
        </View>
        <View className="flex-row gap-3">
          <Button
            variant="classic"
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

function QueuedWithdrawalState({
  withdrawal,
  wallet,
}: {
  withdrawal: WithdrawalRequest;
  wallet: { address: string; getProvider: () => Promise<unknown> } | undefined;
}) {
  const claimMutation = useClaimWithdrawal();

  const statusColor =
    withdrawal.status === "CLAIMABLE"
      ? "text-emerald-400"
      : withdrawal.status === "FAILED"
        ? "text-red-400"
        : "text-amber-400";

  const handleClaim = async () => {
    if (!wallet) return;
    try {
      const provider = (await wallet.getProvider()) as {
        request: (args: unknown) => Promise<{ signature: string }>;
      };
      const signature = await claimMutation.mutateAsync({
        withdrawalId: withdrawal.id,
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
      captureError(err, { source: "queued-claim" });
      Toast.show({
        type: "error",
        text1: "Claim Failed",
        text2: err instanceof Error ? err.message : "Transaction failed",
      });
    }
  };

  return (
    <Card className="mx-5 mt-4">
      <CardHeader>
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Active Withdrawal
        </Text>
      </CardHeader>
      <CardContent className="gap-3">
        <View className="flex-row items-center">
          <View className="mr-2 h-2 w-2 rounded-full bg-amber-500" />
          <Text className={`text-sm font-medium ${statusColor}`}>
            {withdrawal.status}
          </Text>
        </View>

        <Text className="text-xs text-muted-foreground">
          {withdrawal.amount.toLocaleString(undefined, {
            maximumFractionDigits: 6,
          })}{" "}
          shares
        </Text>

        {withdrawal.status === "CLAIMABLE" && (
          <Button
            variant="classic"
            onPress={handleClaim}
            disabled={claimMutation.isPending}
            className={
              claimMutation.isPending
                ? "bg-muted"
                : "bg-emerald-600 active:bg-emerald-700"
            }
            size="lg"
          >
            {claimMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Claim Funds
              </Text>
            )}
          </Button>
        )}
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
  const { data: withdrawals } = useWithdrawals();

  const reconcileMutation = useReconcileWithdrawal();

  // Check for active queued withdrawals for this vault
  const activeWithdrawal = withdrawals?.find(
    (w: WithdrawalRequest) =>
      w.kolVaultId === vaultId &&
      (w.status === "REQUESTED" ||
        w.status === "PROCESSING" ||
        w.status === "CLAIMABLE"),
  );

  const pendingRequest = investorStatus?.pendingRequest;

  // Detect divergence: on-chain REDEMPTION exists but no active DB withdrawal
  const hasDivergence =
    !activeWithdrawal && pendingRequest?.type === "REDEMPTION";

  // Auto-trigger reconcile when divergence detected
  useEffect(() => {
    if (
      hasDivergence &&
      wallet?.address &&
      !reconcileMutation.isPending &&
      !reconcileMutation.isSuccess
    ) {
      reconcileMutation.mutate({ vaultId, walletAddress: wallet.address });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reconcileMutation is unstable; guards inside prevent duplicates
  }, [hasDivergence, wallet?.address, vaultId]);

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

  // Priority: show queued withdrawal if active
  if (activeWithdrawal) {
    return (
      <QueuedWithdrawalState
        withdrawal={activeWithdrawal}
        wallet={wallet}
      />
    );
  }

  // Divergence detected — show syncing state while reconcile runs
  if (hasDivergence) {
    return (
      <Card className="mx-5 mt-4">
        <CardHeader>
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Position
          </Text>
        </CardHeader>
        <CardContent className="items-center gap-3">
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text className="text-sm text-amber-400">
            Syncing withdrawal status...
          </Text>
        </CardContent>
      </Card>
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
