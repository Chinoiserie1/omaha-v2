import { useMemo } from "react";
import type { ChatMessage } from "./use-chat-ws";

export function useChatSearchFilter(
  messages: ChatMessage[],
  searchText: string,
) {
  const isSearchActive = searchText.trim().length > 0;

  const filteredMessages = useMemo(() => {
    if (!isSearchActive) return messages;

    const query = searchText.toLowerCase().trim();
    return messages.filter((m) => m.content.toLowerCase().includes(query));
  }, [messages, searchText, isSearchActive]);

  return { filteredMessages, isSearchActive };
}
