import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/auth-context";
import { useVaultFavorite } from "../../hooks/queries/use-vault-favorite";
import { useToggleVaultFavorite } from "../../hooks/mutations/use-toggle-vault-favorite";

interface FavoriteHeaderButtonProps {
  vaultId: string;
}

export function FavoriteHeaderButton({ vaultId }: FavoriteHeaderButtonProps) {
  const { status } = useAuth();
  const { data } = useVaultFavorite(vaultId);
  const { mutate, isPending } = useToggleVaultFavorite(vaultId);

  if (status !== "authenticated") {
    return null;
  }

  const isFavorited = data?.isFavorited ?? false;

  return (
    <Pressable
      onPress={() => mutate()}
      disabled={isPending}
      className="justify-center items-center ml-1.5 p-1"
      style={{ opacity: isPending ? 0.5 : 1 }}
    >
      <Ionicons
        name={isFavorited ? "star" : "star-outline"}
        size={14}
        color={isFavorited ? "#FBBF24" : "#F8FAFC"}
      />
    </Pressable>
  );
}
