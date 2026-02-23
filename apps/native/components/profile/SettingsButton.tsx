import { useRef } from "react";
import { Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";

export function SettingsButton() {
  const { logout } = usePrivy();
  const router = useRouter();
  const loggingOut = useRef(false);

  const handleLogout = async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;

    try {
      await logout();
      router.replace("/");
    } catch {
      loggingOut.current = false;
    }
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
