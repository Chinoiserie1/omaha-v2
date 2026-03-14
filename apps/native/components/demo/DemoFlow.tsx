import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  SlideInRight,
  SlideOutLeft,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

interface DemoFlowProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Screen 1 — Become a Quant ──────────────────────────────
// Mirrors: apps/native/components/quant/NotQuantState.tsx

function ScreenBecomeQuant() {
  const [pressed, setPressed] = useState(false);

  return (
    <View
      style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}
    >
      <View style={{ marginBottom: 20 }}>
        <Ionicons name="sparkles-outline" size={56} color="#71717A" />
      </View>
      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          color: "#FAFAFA",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        Become a Quant
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: "#71717A",
          textAlign: "center",
          lineHeight: 22,
        }}
      >
        Create your own trading strategy profile and unlock the AI chat
        assistant to help you analyze markets and optimize your portfolio.
      </Text>
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          marginTop: 24,
          width: "100%",
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 32,
          borderRadius: 6,
          backgroundColor: pressed ? "#D4D4D8" : "#FAFAFA",
          transform: [{ scale: pressed ? 0.96 : 1 }],
        }}
      >
        <Text style={{ color: "#09090B", fontWeight: "600", fontSize: 14 }}>
          Get Started
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Screen 2 — No Strategy (Quant with no strategy yet) ────
// Mirrors: apps/native/components/quant/NoStrategyState.tsx

function ScreenNoStrategy() {
  const [pressed, setPressed] = useState(false);

  return (
    <View
      style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}
    >
      <View style={{ marginBottom: 16 }}>
        <Ionicons name="chatbubble-ellipses-outline" size={48} color="#71717A" />
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "600",
          color: "#FAFAFA",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Create Your Strategy
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: "#71717A",
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        Use the AI chat to define your trading thesis and portfolio allocations.
      </Text>
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          marginTop: 24,
          width: "100%",
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 32,
          borderRadius: 6,
          backgroundColor: pressed ? "#D4D4D8" : "#FAFAFA",
          transform: [{ scale: pressed ? 0.96 : 1 }],
        }}
      >
        <Text style={{ color: "#09090B", fontWeight: "600", fontSize: 14 }}>
          Open Chat
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Screen 3 — AI Chat (animated conversation) ─────────────
// Mirrors: apps/native/components/chat/ChatScreen.tsx (ChatConversation)

const CHAT_MESSAGES = [
  {
    role: "assistant" as const,
    text: "Welcome Nadar! I'm your strategy assistant. What assets and market sectors are you most bullish on right now?",
  },
  {
    role: "user" as const,
    text: "I'm very bullish on SOL and the Solana ecosystem. JUP is undervalued and BONK has meme momentum.",
  },
  {
    role: "assistant" as const,
    text: "Based on your thesis, here's a suggested allocation:\n\n• SOL 45% — Core position, Firedancer catalyst\n• JUP 30% — DeFi revenue share play\n• BONK 10% — High-beta memecoin\n• USDC 15% — Dry powder for dips\n\nShall I set this as your strategy?",
  },
  {
    role: "user" as const,
    text: "Yes, that looks perfect. Set it up!",
  },
  {
    role: "assistant" as const,
    text: "Your Quant strategy is now active. I'll monitor your tweets and signals to adjust allocations. You can create a vault to let others invest in your strategy.",
  },
];

// Delay before each message appears (ms)
const MESSAGE_DELAYS = [200, 1000, 800, 1400, 700, 1200];
// Extra delay for AI "typing" indicator before the message shows
const TYPING_DURATION = 600;

function TypingIndicator() {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      className="self-start ml-4 mb-3"
    >
      <View
        className="rounded-2xl px-4 py-3 flex-row items-center"
        style={{ backgroundColor: "#1E293B", gap: 4 }}
      >
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            entering={FadeIn.delay(i * 80).duration(200)}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#475569",
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function ChatBubble({
  msg,
}: {
  msg: (typeof CHAT_MESSAGES)[number];
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(30).duration(200).springify()}
      className={`mb-3 max-w-[85%] ${msg.role === "user" ? "self-end mr-4" : "self-start ml-4"}`}
    >
      <View
        className="rounded-2xl px-4 py-3"
        style={{
          backgroundColor: msg.role === "user" ? "#14B8A6" : "#1E293B",
        }}
      >
        <Text
          className="text-sm leading-5"
          style={{
            color: msg.role === "user" ? "#FFFFFF" : "#CBD5E1",
          }}
        >
          {msg.text}
        </Text>
      </View>
    </Animated.View>
  );
}

function ScreenChat() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Clean up timers on unmount
    const timers = timersRef.current;
    let elapsed = 0;

    CHAT_MESSAGES.forEach((msg, i) => {
      elapsed += MESSAGE_DELAYS[i] ?? 2000;

      if (msg.role === "assistant") {
        // Show typing indicator first
        const typingTimer = setTimeout(() => {
          setShowTyping(true);
          scrollRef.current?.scrollToEnd({ animated: true });
        }, elapsed);
        timers.push(typingTimer);

        elapsed += TYPING_DURATION;

        // Then show the actual message
        const msgTimer = setTimeout(() => {
          setShowTyping(false);
          setVisibleCount(i + 1);
          setTimeout(
            () => scrollRef.current?.scrollToEnd({ animated: true }),
            100,
          );
        }, elapsed);
        timers.push(msgTimer);
      } else {
        // User messages appear directly
        const msgTimer = setTimeout(() => {
          setVisibleCount(i + 1);
          setTimeout(
            () => scrollRef.current?.scrollToEnd({ animated: true }),
            100,
          );
        }, elapsed);
        timers.push(msgTimer);
      }
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  // Current input text — shows what the user is "about to send"
  const nextUserMsg = CHAT_MESSAGES[visibleCount];
  const inputText =
    nextUserMsg?.role === "user" ? nextUserMsg.text : "Message...";
  const inputIsActive = nextUserMsg?.role === "user";

  return (
    <View className="flex-1">
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: "#FAFAFA" }}>
          Chat
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        {CHAT_MESSAGES.slice(0, visibleCount).map((msg, i) => (
          <ChatBubble key={i} msg={msg} />
        ))}
        {showTyping && <TypingIndicator />}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ChatInput */}
      <Animated.View
        className="absolute bottom-8 left-4 right-4 flex-row items-center rounded-2xl px-4 py-3"
        style={{ backgroundColor: inputIsActive ? "#1A2332" : "#1E293B" }}
      >
        <Text
          className="flex-1 text-sm"
          style={{ color: inputIsActive ? "#E2E8F0" : "#64748B" }}
          numberOfLines={1}
        >
          {inputText}
        </Text>
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{
            backgroundColor: inputIsActive ? "#14B8A6" : "#334155",
          }}
        >
          <Ionicons name="arrow-up" size={18} color="#FFF" />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Screen 6 — Quant page (VaultDetail) ────────────────────
// Mirrors: apps/native/components/vault/VaultDetail.tsx sections

function ScreenQuantPage() {
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* Nav bar — matches VaultDetail header bar */}
      <View className="flex-row items-center px-4 py-3">
        <View
          className="justify-center items-center w-10 h-10 rounded-full"
          style={{ backgroundColor: "#1E293B" }}
        >
          <Ionicons name="chevron-back" size={20} color="#F8FAFC" />
        </View>
        <Text
          className="text-base font-semibold text-white flex-1 ml-3"
          numberOfLines={1}
        >
          Nadar
        </Text>
        {/* Invest button */}
        <View
          className="flex-row items-center px-4 py-2 rounded-xl"
          style={{ backgroundColor: "#14B8A6" }}
        >
          <Ionicons name="flash" size={14} color="#FFF" />
          <Text className="text-xs font-bold text-white ml-1">Invest</Text>
        </View>
      </View>

      {/* VaultHeader */}
      <View className="flex-row items-center px-5 pb-4">
        <View style={{ position: "relative" }}>
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 60,
              height: 60,
              borderWidth: 2,
              borderColor: "rgba(59,130,246,0.5)",
            }}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 56, height: 56, backgroundColor: "#1E293B" }}
            >
              <Text
                style={{ color: "#94A3B8", fontSize: 19, fontWeight: "700" }}
              >
                NA
              </Text>
            </View>
          </View>
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "#3B82F6",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: "#0F172A",
            }}
          >
            <Ionicons name="checkmark" size={12} color="#FFF" />
          </View>
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-lg font-bold text-white">Nadar</Text>
          <Text className="text-xs text-slate-400">@nadar_eth · 2h ago</Text>
        </View>
        <View
          className="rounded-md px-2.5 py-1"
          style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
        >
          <Text className="text-xs font-semibold" style={{ color: "#34D399" }}>
            Active
          </Text>
        </View>
      </View>

      {/* VaultThesis */}
      <View className="mx-5 rounded-xl overflow-hidden mb-4" style={{ backgroundColor: "#1E293B" }}>
        <View className="flex-row">
          <View
            style={{
              width: 4,
              backgroundColor: "#3B82F6",
              borderTopLeftRadius: 4,
              borderBottomLeftRadius: 4,
            }}
          />
          <View className="flex-1 p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Investment Thesis
              </Text>
              <Text className="text-slate-500" style={{ fontSize: 10 }}>
                Mar 8, 2026
              </Text>
            </View>
            <Text className="text-sm text-slate-400 leading-5">
              Solana ecosystem is the strongest L1 play this cycle. Heavy SOL
              core backed by Firedancer, JUP as DeFi revenue-share leader, BONK
              for memecoin beta. USDC dry powder for dip entries.
            </Text>
          </View>
        </View>
      </View>

      {/* Allocations header */}
      <View className="flex-row items-center px-5 mb-3">
        <Text className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          Assets Involved
        </Text>
        <View
          className="justify-center items-center ml-2 rounded-full"
          style={{
            backgroundColor: "rgba(59,130,246,0.15)",
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ color: "#3B82F6", fontSize: 10, fontWeight: "600" }}>
            4
          </Text>
        </View>
      </View>

      {/* VaultAllocationCard x4 */}
      <AllocationRow asset="SOL" pct={45} conviction="High" convColor="#34D399" convBg="rgba(16,185,129,0.15)" tokenColor="#14F195" />
      <AllocationRow asset="JUP" pct={30} conviction="High" convColor="#34D399" convBg="rgba(16,185,129,0.15)" tokenColor="#00D4AA" />
      <AllocationRow asset="BONK" pct={10} conviction="Medium" convColor="#FBBF24" convBg="rgba(245,158,11,0.15)" tokenColor="#F7931A" />
      <AllocationRow asset="USDC" pct={15} conviction="Low" convColor="#F87171" convBg="rgba(239,68,68,0.15)" tokenColor="#2775CA" />

      {/* Strategy Updates (rebalance timeline) */}
      <View className="mx-5 mt-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Strategy Updates
        </Text>

        {/* Timeline item */}
        <View className="flex-row">
          <View className="items-center" style={{ width: 24 }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: "#3B82F6",
                borderWidth: 2,
                borderColor: "#3B82F6",
                marginTop: 4,
              }}
            />
            <View
              style={{
                width: 2,
                flex: 1,
                backgroundColor: "#1E293B",
                marginVertical: 2,
              }}
            />
          </View>
          <View className="flex-1 ml-3 mb-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Text className="text-xs text-slate-400">Mar 8, 2026</Text>
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: "rgba(59,130,246,0.15)" }}
              >
                <Text
                  style={{ color: "#3B82F6", fontSize: 11, fontWeight: "600" }}
                >
                  COMPLETED
                </Text>
              </View>
              <Text className="text-xs text-slate-400">2 swaps</Text>
            </View>
            {/* TweetCard */}
            <View
              className="rounded-xl p-3"
              style={{ backgroundColor: "#1E293B" }}
            >
              <View className="flex-row flex-wrap gap-1.5 mb-2">
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: "rgba(59,130,246,0.15)" }}
                >
                  <Text
                    style={{
                      color: "#3B82F6",
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    Score: 9.2
                  </Text>
                </View>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: "rgba(139,92,246,0.15)" }}
                >
                  <Text
                    style={{
                      color: "#A78BFA",
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    SOL
                  </Text>
                </View>
              </View>
              <Text
                className="text-sm text-white leading-5 mb-2"
                numberOfLines={3}
              >
                Solana TPS hitting new ATHs. The Firedancer upgrade is real — adding more SOL and trimming stables. $SOL
              </Text>
              <View className="flex-row gap-3">
                <Text className="text-xs text-slate-500">4.2K likes</Text>
                <Text className="text-xs text-slate-500">890 RT</Text>
                <Text className="text-xs text-slate-500">185K views</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

function AllocationRow({
  asset,
  pct,
  conviction,
  convColor,
  convBg,
  tokenColor,
}: {
  asset: string;
  pct: number;
  conviction: string;
  convColor: string;
  convBg: string;
  tokenColor: string;
}) {
  const initial = asset.charAt(0);
  return (
    <View
      className="mx-5 rounded-xl p-4 flex-row items-center mb-2"
      style={{ backgroundColor: "#1E293B" }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          backgroundColor: tokenColor + "20",
        }}
      >
        <Text style={{ color: tokenColor, fontSize: 16, fontWeight: "700" }}>
          {initial}
        </Text>
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold text-white">{asset}</Text>
      </View>
      <View className="items-end">
        <Text className="text-base font-bold text-white">{pct}%</Text>
        <View
          className="mt-1 rounded-full px-2 py-0.5"
          style={{ backgroundColor: convBg }}
        >
          <Text style={{ color: convColor, fontSize: 10, fontWeight: "600" }}>
            {conviction}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen 7 — Create Vault on-chain ───────────────────────

function ScreenVaultCreated() {
  return (
    <View className="flex-1 justify-center items-center px-8">
      <View
        className="w-20 h-20 rounded-full items-center justify-center mb-6"
        style={{ backgroundColor: "rgba(20,184,166,0.12)" }}
      >
        <Ionicons name="checkmark-circle" size={56} color="#14B8A6" />
      </View>
      <Text className="text-3xl font-bold text-white mb-2">Vault Live!</Text>
      <Text className="text-base text-slate-400 text-center mb-8 leading-5">
        Your strategy is now on-chain.{"\n"}Investors can discover and subscribe.
      </Text>

      <View
        className="w-full p-5 rounded-2xl mb-4"
        style={{ backgroundColor: "#1E293B" }}
      >
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-slate-400">Vault name</Text>
          <Text className="text-sm font-semibold text-white">Nadar</Text>
        </View>
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-slate-400">Symbol</Text>
          <Text className="text-sm font-semibold text-white">NADR</Text>
        </View>
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-slate-400">Network</Text>
          <Text className="text-sm font-semibold text-white">Solana Mainnet</Text>
        </View>
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-slate-400">Protocol</Text>
          <Text className="text-sm font-semibold text-white">Omaha</Text>
        </View>
        <View className="flex-row justify-between py-2">
          <Text className="text-sm text-slate-400">Status</Text>
          <Text className="text-sm font-semibold" style={{ color: "#14B8A6" }}>
            Deployed
          </Text>
        </View>
      </View>

      <View
        className="w-full p-4 rounded-2xl mb-4"
        style={{ backgroundColor: "#1E293B" }}
      >
        <Text className="text-xs font-semibold tracking-wider text-slate-500 mb-2">
          YOUR STRATEGY
        </Text>
        <Text className="text-sm text-slate-300">
          SOL 45% · JUP 30% · BONK 10% · USDC 15%
        </Text>
      </View>

      <View
        className="w-full p-4 rounded-2xl flex-row items-center"
        style={{
          backgroundColor: "rgba(20,184,166,0.06)",
          borderWidth: 1,
          borderColor: "rgba(20,184,166,0.25)",
        }}
      >
        <Ionicons name="people" size={20} color="#14B8A6" />
        <Text className="text-sm text-slate-300 ml-3 flex-1">
          Share your vault link so investors can subscribe
        </Text>
      </View>
    </View>
  );
}

// ─── Screen definitions ──────────────────────────────────────

const SCREENS = [
  { key: "become-quant", label: "Become a Quant", component: ScreenBecomeQuant },
  { key: "no-strategy", label: "No Strategy", component: ScreenNoStrategy },
  { key: "ai-chat", label: "Chat", component: ScreenChat },
  { key: "quant-page", label: "Quant Strategy", component: ScreenQuantPage },
  { key: "vault-created", label: "Vault Created", component: ScreenVaultCreated },
] as const;

// ─── Main component ─────────────────────────────────────────

export function DemoFlow({ visible, onClose }: DemoFlowProps) {
  const [step, setStep] = useState(0);

  const handleTap = useCallback(() => {
    setStep((prev) => {
      if (prev >= SCREENS.length - 1) {
        onClose();
        return 0;
      }
      return prev + 1;
    });
  }, [onClose]);

  const handleClose = useCallback(() => {
    setStep(0);
    onClose();
  }, [onClose]);

  const currentScreen = SCREENS[step] ?? SCREENS[0];
  const CurrentScreen = currentScreen.component;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <Pressable
        className="flex-1"
        style={{ backgroundColor: "#0F172A" }}
        onPress={handleTap}
      >
        <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
          {/* Top bar */}
          <View className="flex-row items-center justify-between px-5 py-2">
            <Pressable
              onPress={handleClose}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: "#1E293B" }}
              hitSlop={12}
            >
              <Ionicons name="close" size={18} color="#F8FAFC" />
            </Pressable>

            <Text className="text-xs font-medium text-slate-500">
              {currentScreen.label}
            </Text>

            <Text className="text-xs font-medium text-slate-500">
              {step + 1}/{SCREENS.length}
            </Text>
          </View>

          {/* Progress bar */}
          <View className="flex-row gap-1 px-5 mb-2">
            {SCREENS.map((_, i) => (
              <View
                key={i}
                className="flex-1 h-0.5 rounded-full"
                style={{
                  backgroundColor: i <= step ? "#14B8A6" : "#1E293B",
                }}
              />
            ))}
          </View>

          {/* Current screen */}
          <Animated.View
            key={step}
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            className="flex-1"
          >
            <CurrentScreen />
          </Animated.View>

          {/* Tap hint */}
          <View className="items-center pb-4">
            <Text className="text-xs text-slate-600">
              {step < SCREENS.length - 1
                ? "Tap anywhere to continue"
                : "Tap to close"}
            </Text>
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}
