import { useRef, useEffect, useCallback } from "react";
import { View, Platform, StyleSheet } from "react-native";
import PagerView from "react-native-pager-view";
import { useBecomeQuantFull } from "@/hooks/mutations/use-become-quant-full";
import { useQuantOnboarding } from "@/contexts/quant-onboarding";
import { ONBOARDING_STEPS } from "./onboarding-steps";
import { OnboardingStep } from "./OnboardingStep";
import { OnboardingBottomBar } from "./OnboardingBottomBar";

interface QuantOnboardingProps {
  onSetupStarted?: () => void;
}

export function QuantOnboarding({ onSetupStarted }: QuantOnboardingProps) {
  const pagerRef = useRef<PagerView>(null);
  const pagerStepRef = useRef(0);
  const {
    step, currentStep, isLastStep, setStep,
    activate, deactivate, registerOnSetupStarted,
  } = useQuantOnboarding();
  const { mutate, isPending } = useBecomeQuantFull();

  // Activate onboarding on mount, deactivate on unmount
  useEffect(() => {
    activate();
    return () => deactivate();
  }, [activate, deactivate]);

  // Register setup callback so ChatBottomAccessory can trigger it on iOS
  useEffect(() => {
    if (onSetupStarted) {
      registerOnSetupStarted(onSetupStarted);
    }
  }, [onSetupStarted, registerOnSetupStarted]);

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      pagerStepRef.current = e.nativeEvent.position;
      setStep(e.nativeEvent.position);
    },
    [setStep],
  );

  const handlePress = useCallback(() => {
    if (isLastStep) {
      mutate(undefined, {
        onSuccess: () => {
          onSetupStarted?.();
        },
      });
    } else if (step !== null) {
      pagerRef.current?.setPage(step + 1);
    }
  }, [isLastStep, step, mutate, onSetupStarted]);

  // Sync pager when step changes from context (e.g. ChatBottomAccessory tap on iOS)
  useEffect(() => {
    if (step !== null && step !== pagerStepRef.current) {
      pagerRef.current?.setPage(step);
      pagerStepRef.current = step;
    }
  }, [step]);

  const safeStep = step ?? 0;

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressRow}>
        {ONBOARDING_STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              { backgroundColor: i <= safeStep ? "#14B8A6" : "#1E293B" },
            ]}
          />
        ))}
      </View>

      {/* Pager */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {ONBOARDING_STEPS.map((s) => (
          <View key={s.id} style={styles.page}>
            <OnboardingStep
              icon={s.icon}
              iconColor={s.iconColor}
              title={s.title}
              description={s.description}
            />
          </View>
        ))}
      </PagerView>

      {/* Android only — iOS uses the native tab bar bottomAccessory */}
      {Platform.OS !== "ios" && currentStep && (
        <OnboardingBottomBar
          ctaLabel={currentStep.ctaLabel}
          ctaIcon={currentStep.ctaIcon}
          isPending={isPending}
          onPress={handlePress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  progressSegment: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
});
