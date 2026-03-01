import { useState, useEffect, useRef } from "react";

/**
 * Countdown hook that returns remaining seconds until a target timestamp.
 * Returns 0 when the target is reached or if targetIso is null.
 */
export function useCountdown(targetIso: string | null): number {
  const [remaining, setRemaining] = useState(() => calcRemaining(targetIso));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(calcRemaining(targetIso));

    if (!targetIso) return;

    intervalRef.current = setInterval(() => {
      const next = calcRemaining(targetIso);
      setRemaining(next);
      if (next <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 1_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetIso]);

  return remaining;
}

function calcRemaining(targetIso: string | null): number {
  if (!targetIso) return 0;
  const diff = new Date(targetIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 1_000));
}

/**
 * Format seconds into "M:SS" display string.
 */
export function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
