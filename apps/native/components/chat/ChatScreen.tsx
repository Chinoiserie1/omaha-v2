import { useEffect, useRef } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Text } from "@/components/ui/text";
import { useMyProfile } from "@/hooks/queries/use-profile";
import { useChatHistory } from "@/hooks/queries/use-chat-history";
import { useChatWs, type ChatMessage } from "@/hooks/use-chat-ws";
import { BecomeQuantScreen } from "./BecomeQuantScreen";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInput } from "./ChatInput";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { ChatEmptyState } from "./ChatEmptyState";
import { TAB_BAR_TOTAL_HEIGHT } from "@/components/navigation/tab-bar-constants";

export function ChatScreen() {
  const { data: profile, isLoading: profileLoading } = useMyProfile();

  if (profileLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!profile?.quantId) {
    return <BecomeQuantScreen />;
  }

  return <ChatConversation />;
}

function ChatConversation() {
  const { data: history } = useChatHistory();
  const {
    messages,
    streamingContent,
    isStreaming,
    sendMessage,
    setMessages,
  } = useChatWs();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const hasLoadedHistory = useRef(false);

  // Load history into local state once
  useEffect(() => {
    if (history && !hasLoadedHistory.current) {
      hasLoadedHistory.current = true;
      // History comes newest-first from API, reverse for display
      setMessages(
        [...history].reverse().map((m) => ({
          ...m,
          role: m.role as "user" | "assistant",
        })),
      );
    }
  }, [history, setMessages]);

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    if (messages.length > 0 || streamingContent) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, streamingContent]);

  const showEmptyState = messages.length === 0 && !isStreaming;

  // Build the streaming bubble if actively streaming
  const streamingBubble: ChatMessage | null = streamingContent
    ? {
        id: "__streaming__",
        role: "assistant",
        content: streamingContent,
        createdAt: new Date().toISOString(),
      }
    : null;

  const displayMessages = streamingBubble
    ? [...messages, streamingBubble]
    : messages;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>

      {showEmptyState ? (
        <ChatEmptyState onSuggestion={sendMessage} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatMessageBubble message={item} />}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            isStreaming && !streamingContent ? (
              <ChatTypingIndicator />
            ) : null
          }
        />
      )}

      <View style={{ paddingBottom: TAB_BAR_TOTAL_HEIGHT }}>
        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#71717A",
    fontSize: 15,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FAFAFA",
  },
  listContent: {
    paddingVertical: 8,
  },
});
