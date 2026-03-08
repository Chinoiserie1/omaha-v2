import { createContext, useContext, useState, type ReactNode } from "react";

interface ChatSearchContextValue {
  searchText: string;
  setSearchText: (text: string) => void;
}

const ChatSearchContext = createContext<ChatSearchContextValue>({
  searchText: "",
  setSearchText: () => {},
});

export function ChatSearchProvider({ children }: { children: ReactNode }) {
  const [searchText, setSearchText] = useState("");

  return (
    <ChatSearchContext.Provider value={{ searchText, setSearchText }}>
      {children}
    </ChatSearchContext.Provider>
  );
}

export function useChatSearch() {
  return useContext(ChatSearchContext);
}
