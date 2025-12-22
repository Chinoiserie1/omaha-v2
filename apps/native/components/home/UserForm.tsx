import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { createUserSchema, type CreateUserDto } from "@repo/shared";
import { formStyles } from "../../styles/home.js";
import { ValidationResult } from "./ValidationResult.js";

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
      <View style={formStyles.form}>
        <Text style={formStyles.label}>Email</Text>
        <TextInput
          style={formStyles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="user@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={formStyles.label}>Name (optional)</Text>
        <TextInput
          style={formStyles.input}
          value={name}
          onChangeText={setName}
          placeholder="John Doe"
        />

        <Pressable style={formStyles.button} onPress={handleValidate}>
          <Text style={formStyles.buttonText}>Validate with Zod</Text>
        </Pressable>
      </View>

      <ValidationResult result={result} />
    </>
  );
}
