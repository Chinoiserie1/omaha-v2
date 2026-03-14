import { View, Text } from "react-native";
import { memo } from "react";

interface VaultInfoProps {
  statePda: string;
  shareMint: string | null;
  vaultSymbol: string;
  quantBio: string | null;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center py-2 border-b border-border last:border-b-0">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text
        className="text-xs text-muted-foreground font-mono max-w-[200px]"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export const VaultInfo = memo(function VaultInfo({
  statePda,
  shareMint,
  vaultSymbol,
  quantBio,
}: VaultInfoProps) {
  return (
    <View className="p-4 mx-5 mt-4 rounded-xl border bg-card border-border">
      <Text className="mb-3 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
        Technical Details
      </Text>
      <InfoRow label="Symbol" value={vaultSymbol} />
      <InfoRow label="State PDA" value={statePda} />
      <InfoRow label="Share Mint" value={shareMint ?? "Not yet created"} />
      {quantBio ? <InfoRow label="Quant Bio" value={quantBio} /> : null}
    </View>
  );
});
