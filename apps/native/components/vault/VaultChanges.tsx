import { View, Text } from "react-native";
import { memo } from "react";

interface VaultChangesProps {
  changes: string[];
}

export const VaultChanges = memo(function VaultChanges({
  changes,
}: VaultChangesProps) {
  if (changes.length === 0) return null;

  return (
    <View className="mx-5">
      <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Strategy Updates
      </Text>

      <View className="relative">
        {changes.map((change, i) => {
          const isFirst = i === 0;
          const isLast = i === changes.length - 1;
          const opacity = Math.max(0.5, 1 - i * 0.15);
          const dotColor = isFirst ? "#3B82F6" : "#475569";
          const dotBorderColor = isFirst ? "#3B82F6" : "#334155";

          return (
            <View key={i} className="flex-row" style={{ opacity }}>
              <View className="items-center" style={{ width: 24 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: dotBorderColor,
                    backgroundColor: isFirst ? dotColor : "transparent",
                    marginTop: 6,
                  }}
                />
                {!isLast && (
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      backgroundColor: "#1E293B",
                      marginVertical: 2,
                    }}
                  />
                )}
              </View>

              <View
                className="flex-1 ml-2 bg-card border border-border rounded-xl p-3"
                style={{ marginBottom: isLast ? 0 : 8 }}
              >
                <Text className="text-sm text-muted-foreground leading-5">
                  {change}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});
