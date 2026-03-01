import { Pressable, View } from "react-native";
import { memo } from "react";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Allocation {
  asset: string;
  percentage: number;
}

interface VaultCardProps {
  name: string;
  description: string;
  allocations: Allocation[];
  onPress?: () => void;
}

export const VaultCard = memo(function VaultCard({
  name,
  description,
  allocations,
  onPress,
}: VaultCardProps) {
  return (
    <Pressable onPress={onPress} className="mb-3 active:opacity-80">
      <Card>
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <Text
            className="text-sm leading-5 text-muted-foreground"
            numberOfLines={2}
          >
            {description}
          </Text>
        </CardHeader>
        {allocations.length > 0 && (
          <CardContent>
            <View className="flex-row flex-wrap gap-1.5">
              {allocations.map((a) => (
                <Badge key={a.asset} variant="secondary">
                  <Text className="text-xs font-medium">{a.asset}</Text>
                </Badge>
              ))}
            </View>
          </CardContent>
        )}
      </Card>
    </Pressable>
  );
});
