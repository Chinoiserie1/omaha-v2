import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface QuantInvestCtaProps {
  onInvest: () => void;
}

export function QuantInvestCta({ onInvest }: QuantInvestCtaProps) {
  return (
    <Card className="mx-5">
      <CardHeader>
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Start Investing
        </Text>
      </CardHeader>
      <CardContent className="gap-4">
        <Text className="text-sm leading-5 text-muted-foreground">
          Put your strategy to work. Start investing and your portfolio will
          automatically follow your allocations.
        </Text>
        <Button
          variant="classic"
          className="flex-row gap-2"
          onPress={onInvest}
        >
          <Ionicons name="trending-up" size={18} color="#FAFAFA" />
          <Text className="text-primary-foreground font-semibold">Invest</Text>
        </Button>
      </CardContent>
    </Card>
  );
}
