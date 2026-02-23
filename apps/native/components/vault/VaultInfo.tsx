import { View, Text } from "react-native";
import { memo } from "react";

interface VaultInfoProps {
  glamStatePda: string;
  glamVaultPda: string | null;
  vaultSymbol: string;
  kolBio: string | null;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2 border-b border-zinc-800 last:border-b-0">
      <Text className="text-xs text-zinc-500">{label}</Text>
      <Text
        className="text-xs text-zinc-400 font-mono max-w-[200px]"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export const VaultInfo = memo(function VaultInfo({
  glamStatePda,
  glamVaultPda,
  vaultSymbol,
  kolBio,
}: VaultInfoProps) {
  return (
    <View className="mx-5 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
        Technical Details
      </Text>
      <InfoRow label="Symbol" value={vaultSymbol} />
      <InfoRow label="State PDA" value={glamStatePda} />
      <InfoRow
        label="Vault PDA"
        value={glamVaultPda ?? "Not yet created"}
      />
      {kolBio ? <InfoRow label="KOL Bio" value={kolBio} /> : null}
    </View>
  );
});
