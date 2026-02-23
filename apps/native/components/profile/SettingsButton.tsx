import { Text, TouchableOpacity } from "react-native";
import { usePrivy } from "@privy-io/expo";

export function SettingsButton() {
  const { logout } = usePrivy();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <TouchableOpacity
      className="bg-zinc-200 dark:bg-zinc-800 py-4 rounded-xl"
      onPress={handleLogout}
      activeOpacity={0.8}
    >
      <Text className="text-zinc-700 dark:text-zinc-300 text-center font-semibold text-base">
        Sign Out
      </Text>
    </TouchableOpacity>
  );
}
