import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { WithdrawScreen } from "../../../../../../components/vault/WithdrawScreen";
import { useVault } from "../../../../../../hooks/queries/use-vaults";

export default function WithdrawRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: vault } = useVault(id);

  return (
    <View className="flex-1 bg-white dark:bg-zinc-950">
      <WithdrawScreen
        vaultId={id}
        vaultName={vault?.name ?? ""}
        mintAddress={vault?.mintAddress ?? ""}
        onClose={() => router.back()}
      />
    </View>
  );
}
