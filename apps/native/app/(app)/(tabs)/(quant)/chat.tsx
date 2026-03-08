import { Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChatScreen } from "../../../../components/chat/ChatScreen";
import { useChatSearch } from "@/contexts/chat-search";

export default function QuantChatRoute() {
  if (Platform.OS === "ios") {
    return <IOSQuantChatRoute />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ChatScreen searchText="" />
    </SafeAreaView>
  );
}

function IOSQuantChatRoute() {
  const { searchText } = useChatSearch();

  return <ChatScreen searchText={searchText} />;
}
