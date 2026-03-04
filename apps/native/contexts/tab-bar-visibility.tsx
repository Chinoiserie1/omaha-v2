import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/** Shape of the tab-bar visibility context consumed by child components. */
interface TabBarVisibilityContextValue {
  /** Whether the floating tab bar is currently visible. */
  readonly isTabBarVisible: boolean;
  /** Hide the tab bar (e.g., during a fullscreen modal or form). */
  readonly hideTabBar: () => void;
  /** Restore tab bar visibility. */
  readonly showTabBar: () => void;
}

const TabBarVisibilityContext =
  createContext<TabBarVisibilityContextValue | null>(null);

/**
 * Provides global show/hide control over the floating tab bar.
 *
 * Wrap this around the navigator tree that contains the `<Tabs>` layout
 * so that any descendant screen can call `hideTabBar()` / `showTabBar()`.
 *
 * Currently mounted in `app/(app)/_layout.tsx`, meaning every screen
 * inside the authenticated app group has access.
 *
 * **How it drives the tab bar:**
 * {@link FloatingGlassTabBar} reads `isTabBarVisible` from this context.
 * When `false`, the tab bar returns `null` (full unmount). When `true`,
 * it remounts with its entering animation.
 *
 * @param props.children - React subtree that can consume the context.
 */
export function TabBarVisibilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  // Stable callbacks — won't cause unnecessary re-renders in consumers.
  const hideTabBar = useCallback(() => setIsTabBarVisible(false), []);
  const showTabBar = useCallback(() => setIsTabBarVisible(true), []);

  // Memoised value object — only changes when `isTabBarVisible` toggles.
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

/**
 * Hook to read and control floating tab bar visibility.
 *
 * Must be called from within a {@link TabBarVisibilityProvider} — throws
 * if the context is missing.
 *
 * @returns `{ isTabBarVisible, hideTabBar, showTabBar }`
 *
 * @example
 * ```tsx
 * const { hideTabBar, showTabBar } = useTabBarVisibility();
 * useEffect(() => { hideTabBar(); return showTabBar; }, []);
 * ```
 */
export function useTabBarVisibility(): TabBarVisibilityContextValue {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    throw new Error(
      "useTabBarVisibility must be used within a TabBarVisibilityProvider",
    );
  }
  return context;
}
