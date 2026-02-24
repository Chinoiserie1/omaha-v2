import { View, Text, Pressable } from "react-native";

interface VaultActionsProps {
  hasMintAddress: boolean;
  onWithdraw: () => void;
}

export function VaultActions({
  hasMintAddress,
  onWithdraw,
}: VaultActionsProps) {
  if (!hasMintAddress) return null;

  return (
    <View className="mx-5 mt-4">
      <Pressable
        onPress={onWithdraw}
        className="py-3 rounded-xl items-center bg-zinc-800 border border-red-600 active:bg-zinc-700"
      >
        <Text className="text-sm font-semibold text-red-400">Withdraw</Text>
      </Pressable>
    </View>
  );
}
