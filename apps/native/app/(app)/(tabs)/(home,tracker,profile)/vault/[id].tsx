import { useLocalSearchParams, useRouter } from "expo-router";
import { VaultDetail } from "../../../../../components/vault/VaultDetail";

export default function VaultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/(home)");
    }
  };

  return <VaultDetail vaultId={id} onBack={handleBack} />;
}
