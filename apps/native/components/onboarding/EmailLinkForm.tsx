import { useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLoginWithEmail, useLinkEmail } from "@privy-io/expo";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EmailStep = "email" | "code";

interface EmailLinkFormProps {
  fromTwitter: boolean;
  onSuccess: (email: string) => void;
}

export function EmailLinkForm({ fromTwitter, onSuccess }: EmailLinkFormProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<EmailStep>("email");

  const loginEmail = useLoginWithEmail({
    onSendCodeSuccess: () => setStep("code"),
    onLoginSuccess: () => onSuccess(email.trim()),
  });

  const linkEmail = useLinkEmail({
    onSendCodeSuccess: () => setStep("code"),
    onLinkSuccess: () => onSuccess(email.trim()),
  });

  const activeFlow = fromTwitter ? linkEmail : loginEmail;
  const sendCode = fromTwitter ? linkEmail.sendCode : loginEmail.sendCode;
  const submitCode = fromTwitter
    ? linkEmail.linkWithCode
    : loginEmail.loginWithCode;

  const flowState = activeFlow.state;
  const isLoading =
    flowState.status === "sending-code" ||
    flowState.status === "submitting-code";
  const hasError = flowState.status === "error";
  const errorMessage =
    hasError && "error" in flowState
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
          <Input
            className="text-lg"
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
            <Text className="mt-2 text-sm text-destructive">
              {errorMessage}
            </Text>
          )}

          <Button
            variant="classic"
            className="mt-4"
            onPress={handleSendCode}
            disabled={isLoading || !email.trim()}
            size="lg"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-lg font-semibold text-primary-foreground">
                Send Code
              </Text>
            )}
          </Button>
        </View>
      ) : (
        <View>
          <Text className="mb-3 text-base text-muted-foreground">
            Enter the code sent to {email}
          </Text>
          <Input
            className="text-center text-lg tracking-widest"
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor="#A1A1AA"
            keyboardType="number-pad"
            maxLength={6}
            editable={!isLoading}
          />

          {errorMessage && (
            <Text className="mt-2 text-sm text-destructive">
              {errorMessage}
            </Text>
          )}

          <Button
            variant="classic"
            className="mt-4"
            onPress={handleSubmitCode}
            disabled={isLoading || !code.trim()}
            size="lg"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-lg font-semibold text-primary-foreground">
                Verify Code
              </Text>
            )}
          </Button>

          <Button
            variant="ghost"
            className="mt-3"
            onPress={handleBack}
            disabled={isLoading}
          >
            <Text className="text-base text-muted-foreground underline">
              Use a different email
            </Text>
          </Button>
        </View>
      )}
    </View>
  );
}
