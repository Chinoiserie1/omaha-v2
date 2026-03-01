import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { createUserSchema, type CreateUserDto } from "@repo/shared";
import { ValidationResult } from "./ValidationResult";

export function UserForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const handleValidate = () => {
    const validation = createUserSchema.safeParse({
      email,
      name: name || undefined,
    });

    if (!validation.success) {
      setResult(
        `Validation Error:\n${validation.error.errors.map((e) => e.message).join("\n")}`
      );
      return;
    }

    const data: CreateUserDto = validation.data;
    setResult(`Valid user data:\n${JSON.stringify(data, null, 2)}`);
  };

  return (
    <>
      <View className="gap-3">
        <Text className="text-base font-medium text-foreground">Email</Text>
        <TextInput
          className="border border-border rounded-lg p-3 text-base"
          value={email}
          onChangeText={setEmail}
          placeholder="user@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text className="text-base font-medium text-foreground">
          Name (optional)
        </Text>
        <TextInput
          className="border border-border rounded-lg p-3 text-base"
          value={name}
          onChangeText={setName}
          placeholder="John Doe"
        />

        <Pressable
          className="bg-primary p-4 rounded-lg items-center active:opacity-80"
          onPress={handleValidate}
        >
          <Text className="text-primary-foreground font-semibold text-base">
            Validate with Zod
          </Text>
        </Pressable>
      </View>

      <ValidationResult result={result} />
    </>
  );
}
