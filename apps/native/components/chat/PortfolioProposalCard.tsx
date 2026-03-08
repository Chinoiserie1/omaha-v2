import { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import type { PortfolioProposal } from "@/hooks/use-chat-ws";
import { useAcceptProposal } from "@/hooks/mutations/use-accept-proposal";
import { useMyProfile } from "@/hooks/queries/use-profile";

interface PortfolioProposalCardProps {
  proposal: PortfolioProposal;
  onAccepted: () => void;
  onRejected: () => void;
}

export function PortfolioProposalCard({
  proposal,
  onAccepted,
  onRejected,
}: PortfolioProposalCardProps) {
  const { data: profile } = useMyProfile();
  const quantId = profile?.quantId ?? null;
  const { mutate: accept, isPending } = useAcceptProposal(quantId);
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    accept(
      {
        thesisSummary: proposal.thesisSummary,
        allocations: proposal.allocations.map((a) => ({
          ...a,
          since: new Date().toISOString().slice(0, 10),
          lastSignal: new Date().toISOString().slice(0, 10),
        })),
        changes: proposal.changes,
      },
      {
        onSuccess: (data) => {
          setAccepted(true);
          onAccepted();
          // Show rebalance status if applicable
          if (data.rebalanceTriggered) {
            // Could show a toast here
          }
        },
      },
    );
  };

  if (accepted) {
    return (
      <View style={[styles.card, styles.cardAccepted]}>
        <View style={styles.headerRow}>
          <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
          <Text style={styles.acceptedText}>Portfolio updated</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="pie-chart-outline" size={18} color="#3B82F6" />
        <Text style={styles.headerText}>Portfolio Proposal</Text>
      </View>

      <Text style={styles.thesis} numberOfLines={2}>
        {proposal.thesisSummary}
      </Text>

      <View style={styles.allocations}>
        {proposal.allocations.slice(0, 5).map((a) => (
          <View key={a.asset} style={styles.allocationRow}>
            <Text style={styles.assetName}>{a.asset}</Text>
            <Text style={styles.percentage}>{a.percentage}%</Text>
          </View>
        ))}
        {proposal.allocations.length > 5 && (
          <Text style={styles.moreText}>
            +{proposal.allocations.length - 5} more
          </Text>
        )}
      </View>

      {proposal.changes.length > 0 && (
        <View style={styles.changes}>
          {proposal.changes.map((change, i) => (
            <Text key={i} style={styles.changeText}>
              {change}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.rejectButton]}
          onPress={onRejected}
          disabled={isPending}
        >
          <Text style={styles.rejectText}>Reject</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.acceptButton]}
          onPress={handleAccept}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.acceptText}>Accept</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    gap: 12,
  },
  cardAccepted: {
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderColor: "rgba(34, 197, 94, 0.2)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3B82F6",
  },
  acceptedText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#22C55E",
  },
  thesis: {
    fontSize: 13,
    color: "#A1A1AA",
    lineHeight: 18,
  },
  allocations: {
    gap: 6,
  },
  allocationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  assetName: {
    fontSize: 14,
    color: "#E2E8F0",
    fontWeight: "500",
  },
  percentage: {
    fontSize: 14,
    color: "#FAFAFA",
    fontWeight: "600",
  },
  moreText: {
    fontSize: 12,
    color: "#71717A",
  },
  changes: {
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    color: "#71717A",
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  acceptButton: {
    backgroundColor: "#22C55E",
  },
  rejectText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  acceptText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
