import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { InvestScreen } from "../../../../../../components/vault/InvestScreen";
import { useVault } from "../../../../../../hooks/queries/use-vaults";

export default function InvestRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: vault } = useVault(id);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <InvestScreen
        vaultId={id}
        vaultName={vault?.name ?? ""}
        onClose={() => router.back()}
      />
    </SafeAreaView>
  );
}
