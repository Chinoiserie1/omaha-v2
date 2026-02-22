import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

interface UsernameInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onAvailabilityChange: (available: boolean) => void;
}

export function UsernameInput({
  value,
  onChangeText,
  onAvailabilityChange,
}: UsernameInputProps) {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const checkAvailability = useCallback(
    async (username: string) => {
      if (!username || username.length < 1) {
        setAvailable(null);
        onAvailabilityChange(false);
        return;
      }

      // Validate format locally first
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError("Only letters, numbers, and underscores");
        setAvailable(false);
        onAvailabilityChange(false);
        return;
      }

      if (username.length > 15) {
        setError("Max 15 characters");
        setAvailable(false);
        onAvailabilityChange(false);
        return;
      }

      setChecking(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/onboarding/check-username`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });

        const data = await response.json();

        if (data.success) {
          setAvailable(data.data.available);
          onAvailabilityChange(data.data.available);
          if (!data.data.available) {
            setError("Username is taken");
          }
        }
      } catch {
        setError("Could not check availability");
        onAvailabilityChange(false);
      } finally {
        setChecking(false);
      }
    },
    [onAvailabilityChange]
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value) {
      setAvailable(null);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      checkAvailability(value);
    }, 400);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, checkAvailability]);

  return (
    <View className="w-full">
      <View className="flex-row items-center border border-zinc-300 rounded-xl px-4 py-3 bg-white">
        <Text className="text-zinc-400 text-lg mr-1">@</Text>
        <TextInput
          className="flex-1 text-lg text-zinc-900"
          value={value}
          onChangeText={onChangeText}
          placeholder="username"
          placeholderTextColor="#A1A1AA"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={15}
        />
        {checking && <ActivityIndicator size="small" color="#71717A" />}
        {!checking && available === true && (
          <Text className="text-green-500 text-lg">&#10003;</Text>
        )}
        {!checking && available === false && (
          <Text className="text-red-500 text-lg">&#10007;</Text>
        )}
      </View>

      {error && (
        <Text className="text-red-500 text-sm mt-2 ml-1">{error}</Text>
      )}

      {available === true && !error && (
        <Text className="text-green-600 text-sm mt-2 ml-1">
          Username is available
        </Text>
      )}
    </View>
  );
}
