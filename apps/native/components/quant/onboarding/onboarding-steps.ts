import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export interface OnboardingStepData {
  readonly id: string;
  readonly icon: IoniconName;
  readonly iconColor: string;
  readonly title: string;
  readonly description: string;
  readonly ctaLabel: string;
  readonly ctaIcon: IoniconName;
}

export const ONBOARDING_STEPS: readonly OnboardingStepData[] = [
  {
    id: "what-is-quant",
    icon: "sparkles",
    iconColor: "#A78BFA",
    title: "Become a Quant",
    description:
      "Quants are strategy creators on Omaha. Your Twitter presence and market insights power an AI-driven portfolio \u2014 share your thesis, attract investors, and earn from your strategy.",
    ctaLabel: "How it works",
    ctaIcon: "arrow-forward",
  },
  {
    id: "ai-analysis",
    icon: "analytics",
    iconColor: "#3B82F6",
    title: "AI Analyzes Your Signals",
    description:
      "Once you connect, our AI scans your tweets to identify trading signals, sentiment, and asset preferences. It learns your style and builds a conviction map of your market thesis.",
    ctaLabel: "What you get",
    ctaIcon: "arrow-forward",
  },
  {
    id: "portfolio",
    icon: "pie-chart",
    iconColor: "#14B8A6",
    title: "Build Your Portfolio",
    description:
      "The AI synthesizes your signals into a portfolio allocation \u2014 each asset gets a conviction level (high, medium, low) with reasoning. You review and refine through the AI chat assistant.",
    ctaLabel: "Go on-chain",
    ctaIcon: "arrow-forward",
  },
  {
    id: "vault",
    icon: "shield-checkmark",
    iconColor: "#F59E0B",
    title: "Deploy Your Vault",
    description:
      "Launch a tokenized vault on Solana where investors can subscribe to your strategy. Your thesis drives real on-chain allocations \u2014 fully transparent, fully on-chain.",
    ctaLabel: "Almost there",
    ctaIcon: "arrow-forward",
  },
  {
    id: "ready",
    icon: "rocket",
    iconColor: "#10B981",
    title: "You're Ready",
    description:
      "Connect your Twitter, let the AI analyze your signals, and start building your Quant strategy. Your vault awaits.",
    ctaLabel: "Get Started",
    ctaIcon: "rocket-outline",
  },
] as const;
