import { TouchableOpacity } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "../../contexts/auth-context";

export function PortfolioSignOutButton() {
  const { signOut } = useAuth();

  return (
    <TouchableOpacity
      className="mb-8 rounded-xl bg-secondary py-4"
      onPress={signOut}
      activeOpacity={0.8}
    >
      <Text className="text-center text-base font-semibold text-muted-foreground">
        Sign Out
      </Text>
    </TouchableOpacity>
  );
}
