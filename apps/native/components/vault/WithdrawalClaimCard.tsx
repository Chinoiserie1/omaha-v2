import { ActivityIndicator, View, Linking } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import Toast from "react-native-toast-message";
import { captureError } from "../../lib/capture-error";
import { useClaimWithdrawal } from "../../hooks/mutations/use-claim-withdrawal";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WithdrawalRequest } from "@repo/shared";

interface WithdrawalClaimCardProps {
  withdrawal: WithdrawalRequest;
}

export function WithdrawalClaimCard({ withdrawal }: WithdrawalClaimCardProps) {
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const claimMutation = useClaimWithdrawal();

  const handleClaim = async () => {
    if (!wallet) return;
    try {
      const provider = await wallet.getProvider();
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
      captureError(err, { source: "withdrawal-claim" });
      Toast.show({
        type: "error",
        text1: "Claim Failed",
        text2: err instanceof Error ? err.message : "Transaction failed",
      });
    }
  };

  const openTx = (sig: string) => {
    Linking.openURL(`https://solscan.io/tx/${sig}`);
  };

  return (
    // <Card className="mx-5 mt-4">
    //   <CardContent className="gap-4 pt-5">
    //     <View className="items-center">
    //       <Text className="text-lg font-bold text-emerald-400">
    //         Ready to Claim
    //       </Text>
    //       <Text className="mt-1 text-sm text-muted-foreground">
    //         {withdrawal.amount.toLocaleString(undefined, {
    //           maximumFractionDigits: 6,
    //         })}{" "}
    //         shares
    //       </Text>
    //     </View>
    <View className="p-4 px-5 pb-0">
      <Button
        variant="classic"
        onPress={handleClaim}
        disabled={claimMutation.isPending || !wallet}
        className={
          claimMutation.isPending || !wallet
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
    </View>
    //   </CardContent>
    // </Card>
  );
}
