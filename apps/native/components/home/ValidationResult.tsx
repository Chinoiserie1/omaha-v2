import { View, Text } from "react-native";

interface ValidationResultProps {
  result: string | null;
}

export function ValidationResult({ result }: ValidationResultProps) {
  if (!result) return null;

  return (
    <View className="bg-gray-100 p-4 rounded-lg mt-4">
      <Text className="font-mono text-sm text-gray-800">{result}</Text>
    </View>
  );
}
