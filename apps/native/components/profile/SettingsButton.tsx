import { Text, TouchableOpacity } from "react-native";
import { useAuth } from "../../contexts/auth-context";

export function SettingsButton() {
  const { signOut } = useAuth();

  return (
    <TouchableOpacity
      className="bg-zinc-200 dark:bg-zinc-800 py-4 rounded-xl"
      onPress={signOut}
      activeOpacity={0.8}
    >
      <Text className="text-zinc-700 dark:text-zinc-300 text-center font-semibold text-base">
        Sign Out
      </Text>
    </TouchableOpacity>
  );
}
