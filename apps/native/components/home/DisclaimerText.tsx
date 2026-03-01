import { Text } from "react-native";

export function DisclaimerText() {
  return (
    <Text className="mt-6 text-center text-xs leading-4"
      style={{ color: "rgba(248,250,252,0.35)" }}>
      Past performance is not indicative of future results. Vault strategies
      involve risk and may result in loss of funds. Do your own research before
      investing.
    </Text>
  );
}
