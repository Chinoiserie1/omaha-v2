import { useEffect, useRef } from "react";
import { View, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { useMyProfile } from "@/hooks/queries/use-profile";
import { useChatHistory } from "@/hooks/queries/use-chat-history";
import { useChatWs, type ChatMessage } from "@/hooks/use-chat-ws";
import { useChatSearchFilter } from "@/hooks/use-chat-search-filter";
import { BecomeQuantScreen } from "./BecomeQuantScreen";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInput } from "./ChatInput";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { ChatEmptyState } from "./ChatEmptyState";
import { PortfolioProposalCard } from "./PortfolioProposalCard";
import { VaultDeployCard } from "./VaultDeployCard";

interface ChatScreenProps {
  searchText: string;
}

export function ChatScreen({ searchText }: ChatScreenProps) {
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

  return <ChatConversation searchText={searchText} />;
}

function ChatConversation({ searchText }: ChatScreenProps) {
  const { data: history } = useChatHistory();
  const {
    messages,
    streamingContent,
    isStreaming,
    sendMessage,
    setMessages,
    pendingProposal,
    clearProposal,
    pendingVaultDeploy,
    clearVaultDeploy,
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

  const { filteredMessages, isSearchActive } = useChatSearchFilter(
    displayMessages,
    searchText,
  );

  const showEmptyState =
    filteredMessages.length === 0 && !isStreaming && !isSearchActive;

  const isIOS = Platform.OS === "ios";

  const handleRejectProposal = () => {
    clearProposal();
    sendMessage("Let's try a different approach.");
  };

  const handleVaultDeployed = () => {
    clearVaultDeploy();
    sendMessage("My vault has been deployed successfully!");
  };

  const handleVaultDeployCancelled = () => {
    clearVaultDeploy();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={isIOS ? "padding" : undefined}
      keyboardVerticalOffset={isIOS ? 0 : 0}
    >
      {showEmptyState ? (
        <ChatEmptyState onSuggestion={sendMessage} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatMessageBubble message={item} />}
          contentContainerStyle={styles.listContent}
          contentInsetAdjustmentBehavior={isIOS ? "automatic" : undefined}
          ListFooterComponent={
            <>
              {isStreaming && !streamingContent ? (
                <ChatTypingIndicator />
              ) : null}
              {pendingProposal && !isStreaming ? (
                <PortfolioProposalCard
                  proposal={pendingProposal}
                  onAccepted={clearProposal}
                  onRejected={handleRejectProposal}
                />
              ) : null}
              {pendingVaultDeploy && !isStreaming ? (
                <VaultDeployCard
                  onDeployed={handleVaultDeployed}
                  onCancelled={handleVaultDeployCancelled}
                />
              ) : null}
            </>
          }
        />
      )}

      <ChatInput onSend={sendMessage} disabled={isStreaming} />
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
  listContent: {
    paddingVertical: 8,
  },
});
