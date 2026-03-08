import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { usePrivy } from "@privy-io/expo";
import { useQueryClient } from "@tanstack/react-query";
import { setTokenProvider, resetTokenProvider } from "../lib/api-client";
import { captureError } from "../lib/capture-error";
import { unregisterPushToken } from "../hooks/use-push-notifications";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isReady, user, getAccessToken, logout } = usePrivy();
  const queryClient = useQueryClient();
  const signingOut = useRef(false);
  const hasValidated = useRef(false);

  // Stabilize Privy function references via refs to prevent
  // useCallback/useMemo deps from changing every render.
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  // Derive status directly from Privy state — no intermediate "loading" overrides.
  // Navigation is handled centrally by RootNavigator in _layout.tsx.
  const status: AuthStatus = useMemo(() => {
    if (!isReady) return "loading";
    return user ? "authenticated" : "unauthenticated";
  }, [isReady, user]);

  console.log("[AuthContext] status:", status, { isReady, hasUser: !!user });

  // Wire token provider once at mount via a stable closure that always
  // delegates to the latest getAccessToken through the ref. This avoids
  // a race condition where child effects (e.g. onboarding) fire API calls
  // before the parent effect has set the token provider.
  useEffect(() => {
    setTokenProvider(() => getAccessTokenRef.current());
    return () => resetTokenProvider();
  }, []);

  // Validate session once after authentication
  useEffect(() => {
    if (status !== "authenticated" || hasValidated.current) return;
    hasValidated.current = true;

    const validateSession = async () => {
      try {
        const token = await getAccessTokenRef.current();
        if (!token) {
          await logoutRef.current();
        }
      } catch (err) {
        captureError(err, { source: "session_validation" });
        await logoutRef.current();
      }
    };
    validateSession();
  }, [status]);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    console.log("[AuthContext] signOut START");

    try {
      await unregisterPushToken();
      queryClient.clear();
      resetTokenProvider();
      await logoutRef.current();
      console.log("[AuthContext] signOut DONE");
      hasValidated.current = false;
    } finally {
      signingOut.current = false;
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, signOut }),
    [status, signOut],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
