import { SafeAreaView } from "react-native-safe-area-context";
import { ChatScreen } from "../../../../components/chat/ChatScreen";

export default function ChatRoute() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ChatScreen />
    </SafeAreaView>
  );
}
