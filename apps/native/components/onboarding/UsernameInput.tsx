import { useState, useEffect, useRef } from "react";
import { View, TextInput, ActivityIndicator } from "react-native";
import { useCheckUsername } from "../../hooks/queries/use-onboarding";
import { Text } from "@/components/ui/text";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const {
    data,
    isFetching,
    error: queryError,
  } = useCheckUsername(debouncedValue);

  const available = data?.available ?? null;
  const checking = isFetching;

  useEffect(() => {
    onAvailabilityChange(available === true);
  }, [available, onAvailabilityChange]);

  const displayError =
    localError ??
    (queryError ? "Could not check availability" : null) ??
    (available === false ? "Username is taken" : null);

  return (
    <View className="w-full">
      <View className="flex-row items-center rounded-xl border border-input bg-background px-4 py-3">
        <Text className="mr-1 text-lg text-muted-foreground">@</Text>
        <TextInput
          className="flex-1 text-lg text-foreground"
          value={value}
          onChangeText={onChangeText}
          placeholder="username"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={15}
        />
        {checking && <ActivityIndicator size="small" color="#94A3B8" />}
        {!checking && available === true && (
          <Text className="text-lg text-green-500">&#10003;</Text>
        )}
        {!checking && available === false && (
          <Text className="text-lg text-destructive">&#10007;</Text>
        )}
      </View>

      {displayError && (
        <Text className="ml-1 mt-2 text-sm text-destructive">
          {displayError}
        </Text>
      )}

      {available === true && !displayError && (
        <Text className="ml-1 mt-2 text-sm text-green-600">
          Username is available
        </Text>
      )}
    </View>
  );
}
