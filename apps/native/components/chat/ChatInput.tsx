import { useState, useRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setText("");
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ask about your strategy..."
          placeholderTextColor="#71717A"
          multiline
          maxLength={2000}
          editable={!disabled}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          returnKeyType="default"
        />
        <Pressable
          style={[styles.sendButton, canSend && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Ionicons
            name="send"
            size={18}
            color={canSend ? "#FAFAFA" : "#71717A"}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: Platform.OS === "ios" ? 4 : 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: "#FAFAFA",
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: Platform.OS === "ios" ? 8 : 6,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonActive: {
    backgroundColor: "#1E3A5F",
  },
});
