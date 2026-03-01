import { ActivityIndicator, View } from "react-native";
import Toast from "react-native-toast-message";
import { captureError } from "../../lib/capture-error";
import { useRetryWithdrawal } from "../../hooks/mutations/use-retry-withdrawal";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WithdrawalRequest } from "@repo/shared";

interface WithdrawalFailedCardProps {
  withdrawal: WithdrawalRequest;
  maxRetries: number;
}

export function WithdrawalFailedCard({
  withdrawal,
  maxRetries,
}: WithdrawalFailedCardProps) {
  const retryMutation = useRetryWithdrawal();
  const canRetry = withdrawal.errorCount < maxRetries;

  const handleRetry = async () => {
    try {
      await retryMutation.mutateAsync(withdrawal.id);
      Toast.show({
        type: "success",
        text1: "Retry Queued",
        text2: "Your withdrawal has been re-queued for processing",
      });
    } catch (err) {
      captureError(err, { source: "withdrawal-retry" });
      Toast.show({
        type: "error",
        text1: "Retry Failed",
        text2: err instanceof Error ? err.message : "Could not retry",
      });
    }
  };

  return (
    <Card className="mx-5 mt-4">
      <CardContent className="gap-4 pt-5">
        <View className="rounded-lg bg-red-500/10 p-3">
          <Text className="text-sm font-medium text-red-400">
            Withdrawal Failed
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            {withdrawal.errorMessage ?? "An unexpected error occurred"}
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            Attempt {withdrawal.errorCount} of {maxRetries}
          </Text>
        </View>

        <Button
          variant="classic"
          onPress={handleRetry}
          disabled={!canRetry || retryMutation.isPending}
          className={
            canRetry && !retryMutation.isPending
              ? "bg-amber-600 active:bg-amber-700"
              : "bg-muted"
          }
          size="lg"
        >
          {retryMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-foreground">
              {canRetry ? "Retry Withdrawal" : "Max retries reached"}
            </Text>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
