import { createContext, useContext, useRef, useState, useCallback, useMemo } from "react";
import type { OnboardingStepData } from "@/components/quant/onboarding/onboarding-steps";
import { ONBOARDING_STEPS } from "@/components/quant/onboarding/onboarding-steps";

interface QuantOnboardingContextValue {
  /** Current step index (0-based), or null when onboarding is not active. */
  step: number | null;
  /** Current step data, or null when onboarding is not active. */
  currentStep: OnboardingStepData | null;
  /** Whether the user is on the last onboarding step. */
  isLastStep: boolean;
  /** Advance to the next step. */
  goNext: () => void;
  /** Set the step directly (e.g. from PagerView). */
  setStep: (index: number) => void;
  /** Activate onboarding (start at step 0). */
  activate: () => void;
  /** Deactivate onboarding (reset to null). */
  deactivate: () => void;
  /** Register a callback for when setup starts (called from bottom accessory). */
  registerOnSetupStarted: (cb: () => void) => void;
  /** Signal that setup has started (triggers registered callback). */
  signalSetupStarted: () => void;
}

const QuantOnboardingContext = createContext<QuantOnboardingContextValue>({
  step: null,
  currentStep: null,
  isLastStep: false,
  goNext: () => {},
  setStep: () => {},
  activate: () => {},
  deactivate: () => {},
  registerOnSetupStarted: () => {},
  signalSetupStarted: () => {},
});

export function QuantOnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [step, setStepRaw] = useState<number | null>(null);
  const onSetupStartedRef = useRef<(() => void) | null>(null);

  const activate = useCallback(() => setStepRaw(0), []);
  const deactivate = useCallback(() => setStepRaw(null), []);

  const goNext = useCallback(() => {
    setStepRaw((prev) => {
      if (prev === null) return null;
      return Math.min(prev + 1, ONBOARDING_STEPS.length - 1);
    });
  }, []);

  const setStep = useCallback((index: number) => {
    setStepRaw(index);
  }, []);

  const registerOnSetupStarted = useCallback((cb: () => void) => {
    onSetupStartedRef.current = cb;
  }, []);

  const signalSetupStarted = useCallback(() => {
    onSetupStartedRef.current?.();
  }, []);

  const currentStep =
    step !== null ? (ONBOARDING_STEPS[step] ?? null) : null;
  const isLastStep = step === ONBOARDING_STEPS.length - 1;

  const value = useMemo(
    () => ({
      step,
      currentStep,
      isLastStep,
      goNext,
      setStep,
      activate,
      deactivate,
      registerOnSetupStarted,
      signalSetupStarted,
    }),
    [step, currentStep, isLastStep, goNext, setStep, activate, deactivate, registerOnSetupStarted, signalSetupStarted],
  );

  return (
    <QuantOnboardingContext.Provider value={value}>
      {children}
    </QuantOnboardingContext.Provider>
  );
}

export function useQuantOnboarding() {
  return useContext(QuantOnboardingContext);
}
