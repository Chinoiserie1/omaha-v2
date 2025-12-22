import { View, Text } from "react-native";
import { resultStyles } from "../../styles/home.js";

interface ValidationResultProps {
  result: string | null;
}

export function ValidationResult({ result }: ValidationResultProps) {
  if (!result) return null;

  return (
    <View style={resultStyles.container}>
      <Text style={resultStyles.text}>{result}</Text>
    </View>
  );
}
