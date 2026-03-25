import { useCallback, useEffect, useRef } from "react";
import { DeviceEventEmitter } from "react-native";

const NEW_SESSION_EVENT = "chat:request_new_session";

/**
 * Used in the layout header to request a new chat session.
 */
export function useChatNewSession() {
  const requestNewSession = useCallback(() => {
    DeviceEventEmitter.emit(NEW_SESSION_EVENT);
  }, []);

  return { requestNewSession };
}

/**
 * Used in ChatScreen/useChatWs to listen for new session requests.
 */
export function useOnNewSessionRequest(handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      NEW_SESSION_EVENT,
      () => handlerRef.current(),
    );
    return () => subscription.remove();
  }, []);
}
