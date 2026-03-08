import { useLocalSearchParams, useRouter } from "expo-router";
import { QuantProfile } from "../../../../../components/explore/QuantProfile";

export default function QuantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/(explore)");
    }
  };

  return <QuantProfile quantId={id} onBack={handleBack} />;
}
