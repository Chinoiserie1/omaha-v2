import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { ChatScreen } from "../../../../components/chat/ChatScreen";
import { useChatSearch } from "@/contexts/chat-search";
import { useActiveTab } from "@/contexts/active-tab";
import { useTabBarVisibility } from "@/contexts/tab-bar-visibility";

export default function ChatRoute() {
  if (Platform.OS === "ios") {
    return <IOSChatRoute />;
  }

  return <AndroidChatRoute />;
}

function AndroidChatRoute() {
  const { hideTabBar, showTabBar } = useTabBarVisibility();

  useFocusEffect(
    useCallback(() => {
      hideTabBar();
      return () => showTabBar();
    }, [hideTabBar, showTabBar]),
  );

  return <ChatScreen searchText="" />;
}

function IOSChatRoute() {
  const { searchText } = useChatSearch();
  const { setActiveTab, clearActiveTab } = useActiveTab();

  useFocusEffect(
    useCallback(() => {
      setActiveTab("(chat)");
      return () => clearActiveTab("(chat)");
    }, [setActiveTab, clearActiveTab]),
  );

  return <ChatScreen searchText={searchText} />;
}
