import { Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../contexts/auth-context";

export function SettingsButton() {
  const { signOut } = useAuth();

  return (
    <TouchableOpacity
      className="bg-secondary py-4 rounded-xl"
      onPress={signOut}
      activeOpacity={0.8}
    >
      <Text className="text-muted-foreground text-center font-semibold text-base">
        Sign Out
      </Text>
    </TouchableOpacity>
  );
}
