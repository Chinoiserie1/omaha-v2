import { View } from "react-native";
import { memo } from "react";
import type { Allocation } from "@repo/shared";
import { Text } from "@/components/ui/text";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { QuantAllocationRow } from "./QuantAllocationRow";

interface AssetsSectionProps {
  allocations: Allocation[];
}

export const AssetsSection = memo(function AssetsSection({
  allocations,
}: AssetsSectionProps) {
  return (
    <Card className="mx-5">
      <CardHeader>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Assets
          </Text>
          <View className="bg-secondary px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-muted-foreground">
              {allocations.length}
            </Text>
          </View>
        </View>
      </CardHeader>
      <CardContent>
        {allocations.map((allocation, index) => (
          <View key={allocation.asset}>
            <QuantAllocationRow
              asset={allocation.asset}
              percentage={allocation.percentage}
              conviction={allocation.conviction}
              reasoning={allocation.reasoning}
            />
            {index < allocations.length - 1 && <Separator />}
          </View>
        ))}
      </CardContent>
    </Card>
  );
});
