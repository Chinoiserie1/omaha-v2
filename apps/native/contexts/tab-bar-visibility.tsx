import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface TabBarVisibilityContextValue {
  readonly isTabBarVisible: boolean;
  readonly hideTabBar: () => void;
  readonly showTabBar: () => void;
}

const TabBarVisibilityContext =
  createContext<TabBarVisibilityContextValue | null>(null);

export function TabBarVisibilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const hideTabBar = useCallback(() => setIsTabBarVisible(false), []);
  const showTabBar = useCallback(() => setIsTabBarVisible(true), []);

  const value = useMemo(
    () => ({ isTabBarVisible, hideTabBar, showTabBar }),
    [isTabBarVisible, hideTabBar, showTabBar],
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility(): TabBarVisibilityContextValue {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    throw new Error(
      "useTabBarVisibility must be used within a TabBarVisibilityProvider",
    );
  }
  return context;
}
