import { useLocalSearchParams, useRouter } from "expo-router";
import { StrategyUpdatesList } from "../../../../../../components/vault/StrategyUpdatesList";

export default function StrategyUpdatesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <StrategyUpdatesList
      vaultId={id}
      onBack={() => router.back()}
    />
  );
}
