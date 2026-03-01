import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCountdown, formatCountdown } from "../../hooks/use-countdown";
import type { WithdrawalStatus } from "@repo/shared";

interface WithdrawalTimelineProps {
  status: WithdrawalStatus;
  requestedAt: string;
  processingAt: string | null;
  claimableAt: string | null;
  claimedAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  estimatedFulfillAt: string | null;
}

interface Step {
  label: string;
  key: WithdrawalStatus;
  timestamp: string | null;
}

const STATUS_ORDER: WithdrawalStatus[] = [
  "REQUESTED",
  "PROCESSING",
  "CLAIMABLE",
  "CLAIMED",
];

function getStepState(
  stepStatus: WithdrawalStatus,
  currentStatus: WithdrawalStatus,
): "done" | "current" | "pending" | "failed" {
  if (currentStatus === "FAILED") {
    const currentIdx = STATUS_ORDER.indexOf(stepStatus);
    const failIdx = STATUS_ORDER.indexOf("PROCESSING");
    if (currentIdx < failIdx) return "done";
    if (currentIdx === failIdx) return "failed";
    return "pending";
  }

  const stepIdx = STATUS_ORDER.indexOf(stepStatus);
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);

  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "current";
  return "pending";
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "Waiting...";
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ICON_MAP = {
  done: { name: "checkmark-circle" as const, color: "#14B8A6" },
  current: { name: "time" as const, color: "#f59e0b" },
  pending: { name: "ellipse-outline" as const, color: "#94A3B8" },
  failed: { name: "close-circle" as const, color: "#EF4444" },
};

export function WithdrawalTimeline({
  status,
  requestedAt,
  processingAt,
  claimableAt,
  claimedAt,
  failedAt,
  errorMessage,
  estimatedFulfillAt,
}: WithdrawalTimelineProps) {
  const remaining = useCountdown(
    status === "PROCESSING" ? estimatedFulfillAt : null,
  );

  const steps: Step[] = [
    { label: "Requested", key: "REQUESTED", timestamp: requestedAt },
    { label: "Processing", key: "PROCESSING", timestamp: processingAt },
    { label: "Claimable", key: "CLAIMABLE", timestamp: claimableAt },
    { label: "Claimed", key: "CLAIMED", timestamp: claimedAt },
  ];

  return (
    <Card className="mx-5 mt-4">
      <CardHeader>
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Withdrawal Status
        </Text>
      </CardHeader>
      <CardContent className="gap-0">
        {steps.map((step, idx) => {
          const state = getStepState(step.key, status);
          const icon = ICON_MAP[state];
          const isLast = idx === steps.length - 1;
          const showCountdown =
            step.key === "PROCESSING" && state === "current" && remaining > 0;

          return (
            <View key={step.key} className="flex-row">
              {/* Icon + connector line */}
              <View className="mr-3 items-center" style={{ width: 24 }}>
                <Ionicons name={icon.name} size={20} color={icon.color} />
                {!isLast && (
                  <View
                    className="my-1 w-[2px] flex-1"
                    style={{
                      backgroundColor:
                        state === "done" ? "#14B8A6" : "#334155",
                      minHeight: 20,
                    }}
                  />
                )}
              </View>

              {/* Label + timestamp / countdown */}
              <View className="mb-3 flex-1">
                <Text
                  className={`text-sm font-medium ${
                    state === "done"
                      ? "text-emerald-400"
                      : state === "current"
                        ? "text-amber-400"
                        : state === "failed"
                          ? "text-red-400"
                          : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {formatTimestamp(step.timestamp)}
                </Text>
                {showCountdown && (
                  <View className="mt-1 flex-row items-center">
                    <Ionicons
                      name="hourglass-outline"
                      size={12}
                      color="#F59E0B"
                    />
                    <Text className="ml-1 text-xs font-medium text-amber-400">
                      Claimable in ~{formatCountdown(remaining)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Error message for FAILED status */}
        {status === "FAILED" && failedAt && (
          <View className="mt-2 rounded-lg bg-red-500/10 p-3">
            <Text className="text-xs text-red-400">
              {errorMessage ?? "Processing failed"}
            </Text>
          </View>
        )}
      </CardContent>
    </Card>
  );
}
