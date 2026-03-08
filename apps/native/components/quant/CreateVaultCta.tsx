import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function CreateVaultCta() {
  return (
    <Card className="mx-5">
      <CardHeader>
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          On-Chain Vault
        </Text>
      </CardHeader>
      <CardContent className="gap-4">
        <Text className="text-sm leading-5 text-muted-foreground">
          Deploy your strategy as a tokenized vault on Solana. Investors can
          subscribe and your portfolio rebalances automatically.
        </Text>
        <Button variant="classic" onPress={() => {}}>
          <Text className="text-primary-foreground font-semibold">
            Create Vault
          </Text>
        </Button>
      </CardContent>
    </Card>
  );
}
