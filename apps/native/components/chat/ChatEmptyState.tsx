import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { GlassView } from "@/components/ui/glass";

const THESIS_PROMPTS = [
  "I want 50% SOL because I think Solana will lead this cycle, 30% JUP for the DEX dominance, and 20% USDC as dry powder",
  "Put me 40% in SOL, 25% JTO, 20% BONK, and 15% USDC — I'm betting on Solana ecosystem growth and memecoin momentum",
  "I want 60% SOL and 40% USDC — I'm bullish long-term but want to buy dips if we get a correction",
  "Give me 30% SOL, 30% JUP, 20% PYTH, 20% USDC — I believe in Solana infra plays this quarter",
  "I want 35% SOL, 25% mSOL, 25% jitoSOL, 15% USDC — staking yield is my thesis, I want max LST exposure",
  "Put me 50% USDC and 50% SOL — I'm cautious but don't want to miss the next leg up",
  "I want 40% SOL, 20% RNDR, 20% HNT, 20% USDC — AI and DePIN are the narratives I'm playing",
  "Go aggressive: 60% SOL, 20% JUP, 10% BONK, 10% WIF — I think we're early in a bull run",
  "I want 30% SOL, 20% JUP, 15% PYTH, 15% W, 20% USDC — broad Solana ecosystem exposure with some safety",
  "Put 45% in SOL, 25% in JTO, and 30% USDC — I want to capture Jito's growth while staying partially hedged",
  "I want 50% in LSTs split between mSOL and jitoSOL, 30% SOL, 20% USDC — yield-focused strategy",
  "Give me 35% SOL, 25% JUP, 15% RNDR, 10% PYTH, 15% USDC — diversified Solana with an AI tilt",
  "I'm bearish short-term: 70% USDC, 20% SOL, 10% JUP — ready to deploy when prices drop",
  "All in on infra: 30% SOL, 25% JUP, 20% JTO, 15% PYTH, 10% USDC — I think protocols will outperform tokens",
  "I want 40% SOL, 30% BONK, 15% WIF, 15% USDC — memecoins are leading this cycle and I want to ride it",
  "Put me 50% SOL, 20% HNT, 15% RNDR, 15% USDC — I believe DePIN will have a breakout quarter",
];

const DISPLAY_COUNT = 3;

function pickRandom(items: string[], count: number): string[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function ChatEmptyState() {
  const suggestions = useMemo(
    () => pickRandom(THESIS_PROMPTS, DISPLAY_COUNT),
    [],
  );

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name="sparkles-outline" size={48} color="#71717A" />
      </View>
      <Text style={styles.title}>{"What's your thesis?"}</Text>
      <Text style={styles.subtitle}>
        {"Tell me your trading strategy and I'll build a portfolio around it."}
      </Text>
      <View style={styles.suggestions}>
        {suggestions.map((text) => (
          <GlassView key={text} style={styles.chip}>
            <View style={styles.chipInner}>
              <Text style={styles.chipText}>{text}</Text>
            </View>
          </GlassView>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FAFAFA",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  suggestions: {
    gap: 8,
    width: "100%",
    alignItems: "center",
  },
  chip: {
    borderRadius: 20,
  },
  chipInner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipText: {
    color: "#E2E8F0",
    fontSize: 13,
    textAlign: "center",
  },
});
