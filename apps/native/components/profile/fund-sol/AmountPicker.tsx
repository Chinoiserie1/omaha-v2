import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";

interface AmountPickerProps {
  selected: number;
  onSelect: (amount: number) => void;
}

const AMOUNTS = [1, 2, 3, 4, 5];

export function AmountPicker({ selected, onSelect }: AmountPickerProps) {
  return (
    <View className="flex-row justify-between gap-3">
      {AMOUNTS.map((amount) => {
        const isSelected = selected === amount;
        return (
          <Pressable
            key={amount}
            onPress={() => onSelect(amount)}
            className={`h-12 w-12 items-center justify-center rounded-full ${
              isSelected ? "bg-primary" : "bg-secondary"
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                isSelected ? "text-primary-foreground" : "text-foreground"
              }`}
            >
              ${amount}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
