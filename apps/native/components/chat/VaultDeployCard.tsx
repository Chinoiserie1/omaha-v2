import { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { useDeployVault } from "@/hooks/mutations/use-deploy-vault";
import { useMyProfile } from "@/hooks/queries/use-profile";

interface VaultDeployCardProps {
  onDeployed: () => void;
  onCancelled: () => void;
}

export function VaultDeployCard({
  onDeployed,
  onCancelled,
}: VaultDeployCardProps) {
  const { data: profile } = useMyProfile();
  const quantId = profile?.quantId ?? null;
  const { mutate: deploy, isPending } = useDeployVault(quantId);
  const [deployed, setDeployed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeploy = () => {
    setError(null);
    deploy(undefined, {
      onSuccess: () => {
        setDeployed(true);
        onDeployed();
      },
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : "Vault deployment failed";
        setError(message);
      },
    });
  };

  if (deployed) {
    return (
      <View style={[styles.card, styles.cardDeployed]}>
        <View style={styles.headerRow}>
          <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
          <Text style={styles.deployedText}>Vault deployed on-chain</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="rocket-outline" size={18} color="#8B5CF6" />
        <Text style={styles.headerText}>Deploy Vault On-Chain</Text>
      </View>

      <Text style={styles.description}>
        Create your tokenized vault on Solana. This will
        deploy your strategy on-chain so investors can subscribe.
      </Text>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Network</Text>
          <Text style={styles.detailValue}>Solana Mainnet</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Protocol</Text>
          <Text style={styles.detailValue}>Omaha</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Base Asset</Text>
          <Text style={styles.detailValue}>USDC</Text>
        </View>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.cancelButton]}
          onPress={onCancelled}
          disabled={isPending}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.deployButton]}
          onPress={handleDeploy}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.deployText}>Deploy</Text>
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
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    gap: 12,
  },
  cardDeployed: {
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
    color: "#8B5CF6",
  },
  deployedText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#22C55E",
  },
  description: {
    fontSize: 13,
    color: "#A1A1AA",
    lineHeight: 18,
  },
  details: {
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 13,
    color: "#71717A",
  },
  detailValue: {
    fontSize: 13,
    color: "#E2E8F0",
    fontWeight: "500",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
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
  cancelButton: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  deployButton: {
    backgroundColor: "#8B5CF6",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  deployText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
