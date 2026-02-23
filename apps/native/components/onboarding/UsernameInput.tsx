import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useCheckUsername } from "../../hooks/queries/use-onboarding";

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
  const [debouncedValue, setDebouncedValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Local validation + debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value) {
      setDebouncedValue("");
      setLocalError(null);
      onAvailabilityChange(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setLocalError("Only letters, numbers, and underscores");
      setDebouncedValue("");
      onAvailabilityChange(false);
      return;
    }

    if (value.length > 15) {
      setLocalError("Max 15 characters");
      setDebouncedValue("");
      onAvailabilityChange(false);
      return;
    }

    setLocalError(null);

    debounceRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, onAvailabilityChange]);

  const { data, isFetching, error: queryError } = useCheckUsername(debouncedValue);

  const available = data?.available ?? null;
  const checking = isFetching;

  // Sync availability to parent
  useEffect(() => {
    onAvailabilityChange(available === true);
  }, [available, onAvailabilityChange]);

  const displayError =
    localError ??
    (queryError ? "Could not check availability" : null) ??
    (available === false ? "Username is taken" : null);

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

      {displayError && (
        <Text className="text-red-500 text-sm mt-2 ml-1">{displayError}</Text>
      )}

      {available === true && !displayError && (
        <Text className="text-green-600 text-sm mt-2 ml-1">
          Username is available
        </Text>
      )}
    </View>
  );
}
