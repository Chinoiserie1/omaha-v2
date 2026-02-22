import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLoginWithEmail, useLinkEmail } from "@privy-io/expo";

type EmailStep = "email" | "code";

interface EmailLinkFormProps {
  /** If true, uses useLinkEmail (for already-authenticated Twitter users) */
  fromTwitter: boolean;
  onSuccess: (email: string) => void;
}

export function EmailLinkForm({ fromTwitter, onSuccess }: EmailLinkFormProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<EmailStep>("email");

  // Login with email (for non-Twitter users)
  const loginEmail = useLoginWithEmail({
    onSendCodeSuccess: () => setStep("code"),
    onLoginSuccess: () => onSuccess(email.trim()),
  });

  // Link email (for Twitter-authenticated users)
  const linkEmail = useLinkEmail({
    onSendCodeSuccess: () => setStep("code"),
    onLinkSuccess: () => onSuccess(email.trim()),
  });

  const activeFlow = fromTwitter ? linkEmail : loginEmail;
  const sendCode = fromTwitter ? linkEmail.sendCode : loginEmail.sendCode;
  const submitCode = fromTwitter ? linkEmail.linkWithCode : loginEmail.loginWithCode;

  const flowState = activeFlow.state;
  const isLoading =
    flowState.status === "sending-code" ||
    flowState.status === "submitting-code";
  const hasError = flowState.status === "error";
  const errorMessage = hasError && "error" in flowState
    ? (flowState.error as Error)?.message
    : null;

  const handleSendCode = async () => {
    if (!email.trim()) return;
    await sendCode({ email: email.trim() });
  };

  const handleSubmitCode = async () => {
    if (!code.trim()) return;
    if (fromTwitter) {
      await (submitCode as typeof linkEmail.linkWithCode)({
        code: code.trim(),
        email: email.trim(),
      });
    } else {
      await (submitCode as typeof loginEmail.loginWithCode)({
        code: code.trim(),
        email: email.trim(),
      });
    }
  };

  const handleBack = () => {
    setStep("email");
    setCode("");
  };

  return (
    <View className="w-full">
      {step === "email" ? (
        <View>
          <TextInput
            className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-lg bg-white text-zinc-900"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#A1A1AA"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isLoading}
          />

          {errorMessage && (
            <Text className="text-red-500 text-sm mt-2">
              {errorMessage}
            </Text>
          )}

          <TouchableOpacity
            className={`mt-4 py-4 rounded-xl ${
              isLoading || !email.trim() ? "bg-zinc-400" : "bg-zinc-900"
            }`}
            onPress={handleSendCode}
            disabled={isLoading || !email.trim()}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                Send Code
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text className="text-base text-zinc-600 mb-3">
            Enter the code sent to {email}
          </Text>
          <TextInput
            className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-lg bg-white text-center tracking-widest text-zinc-900"
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor="#A1A1AA"
            keyboardType="number-pad"
            maxLength={6}
            editable={!isLoading}
          />

          {errorMessage && (
            <Text className="text-red-500 text-sm mt-2">
              {errorMessage}
            </Text>
          )}

          <TouchableOpacity
            className={`mt-4 py-4 rounded-xl ${
              isLoading || !code.trim() ? "bg-zinc-400" : "bg-zinc-900"
            }`}
            onPress={handleSubmitCode}
            disabled={isLoading || !code.trim()}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-lg">
                Verify Code
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-3 py-2"
            onPress={handleBack}
            disabled={isLoading}
          >
            <Text className="text-zinc-600 text-center text-base underline">
              Use a different email
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
