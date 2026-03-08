import { View, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import type { ChatMessage } from "@/hooks/use-chat-ws";

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

function stripPortfolioBlock(text: string): string {
  return text.replace(/\n*```portfolio\s*\n[\s\S]*?\n```\s*/g, "").trim();
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const displayContent = isUser
    ? message.content
    : stripPortfolioBlock(message.content);

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}
        >
          {displayContent}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  rowUser: {
    alignItems: "flex-end",
  },
  rowAssistant: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: "#1E3A5F",
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  textUser: {
    color: "#FAFAFA",
  },
  textAssistant: {
    color: "#E2E8F0",
  },
});
