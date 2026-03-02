import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Card, CardContent } from "@/components/ui/card";
import { ActiveThesisRow } from "./ActiveThesisRow";
import type { ActiveThesisItem } from "@repo/shared";

interface ActiveThesisListProps {
  theses: ActiveThesisItem[];
  onThesisPress?: (vaultId: string) => void;
}

export function ActiveThesisList({
  theses,
  onThesisPress,
}: ActiveThesisListProps) {
  if (theses.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardContent className="gap-1">
        <Text className="mb-2 text-sm font-semibold">Active Theses</Text>
        {theses.map((thesis, index) => (
          <View key={thesis.vaultId}>
            <ActiveThesisRow
              name={thesis.name}
              kolUsername={thesis.kolUsername}
              assetCount={thesis.assetCount}
              valueUsd={thesis.valueUsd}
              pnlPercent={thesis.pnlPercent}
              {...(onThesisPress && {
                onPress: () => onThesisPress(thesis.vaultId),
              })}
            />
            {index < theses.length - 1 && (
              <View className="h-px bg-border" />
            )}
          </View>
        ))}
      </CardContent>
    </Card>
  );
}
