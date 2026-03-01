import { useReducer, useCallback, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import type { PortfolioTokenItem } from "@repo/shared";
import { useWalletPortfolio } from "../../../hooks/queries/use-wallet-portfolio";
import { useTokenTransfer } from "../../../hooks/use-token-transfer";
import { Text } from "@/components/ui/text";
import { TokenPicker } from "./TokenPicker";
import { TransferForm } from "./TransferForm";
import { TransferReview } from "./TransferReview";
import { TransferSuccess } from "./TransferSuccess";

// --- State machine ---

type Step = "pick" | "form" | "review" | "success";

interface FlowState {
  step: Step;
  token: PortfolioTokenItem | null;
  recipient: string;
  amount: string;
  txSignature: string | null;
}

type FlowAction =
  | { type: "SELECT_TOKEN"; token: PortfolioTokenItem }
  | { type: "SET_TRANSFER"; recipient: string; amount: string }
  | { type: "CONFIRM_SUCCESS"; txSignature: string }
  | { type: "BACK" };

const initialState: FlowState = {
  step: "pick",
  token: null,
  recipient: "",
  amount: "",
  txSignature: null,
};

function reducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "SELECT_TOKEN":
      return { ...state, step: "form", token: action.token };
    case "SET_TRANSFER":
      return {
        ...state,
        step: "review",
        recipient: action.recipient,
        amount: action.amount,
      };
    case "CONFIRM_SUCCESS":
      return { ...state, step: "success", txSignature: action.txSignature };
    case "BACK":
      if (state.step === "form") return { ...initialState };
      if (state.step === "review") return { ...state, step: "form" };
      return state;
    default:
      return state;
  }
}

// --- Component ---

export function WithdrawFlow() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const { data: portfolio, isLoading } = useWalletPortfolio(wallet?.address);
  const { send, sending, error: transferError } = useTokenTransfer();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [flowError, setFlowError] = useState<string | null>(null);

  const error = transferError ?? flowError;

  const tokens: PortfolioTokenItem[] =
    portfolio?.items.filter(
      (item): item is PortfolioTokenItem => item.type === "token",
    ) ?? [];

  const handleConfirm = useCallback(async () => {
    if (!state.token) return;
    setFlowError(null);
    try {
      const signature = await send(state.token, state.recipient, state.amount);
      dispatch({ type: "CONFIRM_SUCCESS", txSignature: signature });
    } catch (err) {
      // Fallback: surface the error even if useTokenTransfer didn't set it
      const message =
        err instanceof Error ? err.message : "Transaction failed";
      setFlowError(message);
    }
  }, [send, state.token, state.recipient, state.amount]);

  if (isLoading || !wallet) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#94A3B8" />
      </View>
    );
  }

  if (tokens.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-muted-foreground">
          No tokens available to send.
        </Text>
      </View>
    );
  }

  switch (state.step) {
    case "pick":
      return (
        <TokenPicker
          tokens={tokens}
          onSelect={(token) => dispatch({ type: "SELECT_TOKEN", token })}
          onBack={() => router.back()}
        />
      );
    case "form":
      return (
        <TransferForm
          token={state.token!}
          onBack={() => dispatch({ type: "BACK" })}
          onContinue={(recipient, amount) =>
            dispatch({ type: "SET_TRANSFER", recipient, amount })
          }
        />
      );
    case "review":
      return (
        <TransferReview
          token={state.token!}
          recipient={state.recipient}
          amount={state.amount}
          sending={sending}
          error={error}
          onBack={() => dispatch({ type: "BACK" })}
          onConfirm={handleConfirm}
        />
      );
    case "success":
      return (
        <TransferSuccess
          txSignature={state.txSignature!}
          onDone={() => router.back()}
        />
      );
  }
}
