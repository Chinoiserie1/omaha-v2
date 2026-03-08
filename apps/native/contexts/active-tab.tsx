import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

interface ActiveTabContextValue {
  /** The currently focused tab route name (e.g. "(quant)", "(chat)"). */
  readonly activeTab: string;
  /** Mark a tab as active — call on focus. */
  readonly setActiveTab: (tab: string) => void;
  /** Deferred clear — only clears if no other tab claimed focus first. */
  readonly clearActiveTab: (tab: string) => void;
}

const ActiveTabContext = createContext<ActiveTabContextValue>({
  activeTab: "",
  setActiveTab: () => {},
  clearActiveTab: () => {},
});

/**
 * Tracks which tab is currently focused so other parts of the UI
 * can react (e.g. showing/hiding the search tab dynamically).
 *
 * Uses a ref + deferred cleanup to avoid race conditions when
 * switching between tabs in the same event loop tick.
 */
export function ActiveTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTabState] = useState("");
  const activeRef = useRef("");

  const setActiveTab = useCallback((tab: string) => {
    activeRef.current = tab;
    setActiveTabState(tab);
  }, []);

  const clearActiveTab = useCallback((tab: string) => {
    // Defer so that if another tab's focus fires in the same tick,
    // the ref is already updated and we skip the stale clear.
    setTimeout(() => {
      if (activeRef.current === tab) {
        activeRef.current = "";
        setActiveTabState("");
      }
    }, 0);
  }, []);

  const value = useMemo(
    () => ({ activeTab, setActiveTab, clearActiveTab }),
    [activeTab, setActiveTab, clearActiveTab],
  );

  return (
    <ActiveTabContext.Provider value={value}>
      {children}
    </ActiveTabContext.Provider>
  );
}

export function useActiveTab() {
  return useContext(ActiveTabContext);
}
