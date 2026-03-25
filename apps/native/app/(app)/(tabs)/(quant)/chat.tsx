import { Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatScreen } from "../../../../components/chat/ChatScreen";

export default function QuantChatRoute() {
  if (Platform.OS === "ios") {
    return <ChatScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ChatScreen />
    </SafeAreaView>
  );
}
