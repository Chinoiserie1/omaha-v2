import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import { useMemo } from "react";
import { VaultDetail } from "../../../../../../components/vault/VaultDetail";

export default function VaultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const segments = useSegments();

  const tabSegment = useMemo(
    () => segments.find((s) => ["(home)", "(profile)"].includes(s)) ?? "(home)",
    [segments],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/(home)");
    }
  };

  return (
    <VaultDetail
      vaultId={id}
      onBack={handleBack}
      onInvest={() =>
        router.push(`/(app)/(tabs)/${tabSegment}/vault/${id}/invest` as never)
      }
      onWithdraw={() =>
        router.push(`/(app)/(tabs)/${tabSegment}/vault/${id}/withdraw` as never)
      }
    />
  );
}
