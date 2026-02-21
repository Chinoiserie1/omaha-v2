import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLoginWithEmail } from "@privy-io/expo";

type LoginStep = "email" | "code";

export function EmailLoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<LoginStep>("email");

  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onSendCodeSuccess: () => {
      setStep("code");
    },
  });

  const isLoading = state.status === "sending-code" || state.status === "submitting-code";
  const hasError = state.status === "error";

  const handleSendCode = async () => {
    if (!email.trim()) return;
    await sendCode({ email: email.trim() });
  };

  const handleLogin = async () => {
    if (!code.trim()) return;
    await loginWithCode({ code: code.trim(), email: email.trim() });
  };

  const handleBack = () => {
    setStep("email");
    setCode("");
  };

  return (
    <View className="w-full">
      {step === "email" ? (
        <View>
          <Text className="text-base text-gray-700 mb-2">Email Address</Text>
          <TextInput
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isLoading}
          />

          {hasError && state.error && (
            <Text className="text-red-500 text-sm mt-2">
              {state.error.message}
            </Text>
          )}

          <TouchableOpacity
            className={`mt-4 py-3 rounded-lg ${
              isLoading || !email.trim() ? "bg-gray-300" : "bg-gray-900"
            }`}
            onPress={handleSendCode}
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Continue with Email
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text className="text-base text-gray-700 mb-2">
            Enter the code sent to {email}
          </Text>
          <TextInput
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base bg-white text-center tracking-widest"
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            editable={!isLoading}
          />

          {hasError && state.error && (
            <Text className="text-red-500 text-sm mt-2">
              {state.error.message}
            </Text>
          )}

          <TouchableOpacity
            className={`mt-4 py-3 rounded-lg ${
              isLoading || !code.trim() ? "bg-gray-300" : "bg-gray-900"
            }`}
            onPress={handleLogin}
            disabled={isLoading || !code.trim()}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Verify Code
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-3 py-2"
            onPress={handleBack}
            disabled={isLoading}
          >
            <Text className="text-gray-900 text-center text-base underline">
              Use a different email
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
