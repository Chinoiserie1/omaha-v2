import { Text, TextClassContext } from "@/components/ui/text";
import { GlassView } from "@/components/ui/glass";
import { cn } from "@/lib/utils";
import { View, type ViewProps } from "react-native";

type CardVariant = "glass" | "classic";

type CardProps = ViewProps &
  React.RefAttributes<View> & {
    variant?: CardVariant;
  };

function Card({ className, variant = "glass", ...props }: CardProps) {
  if (variant === "classic") {
    return (
      <TextClassContext.Provider value="text-card-foreground">
        <View
          className={cn(
            "bg-card border-border flex flex-col gap-6 rounded-xl border py-6 shadow-sm shadow-black/5",
            className,
          )}
          {...props}
        />
      </TextClassContext.Provider>
    );
  }

  return (
    <TextClassContext.Provider value="text-card-foreground">
      <GlassView
        className={cn("flex flex-col gap-6 rounded-xl py-6", className)}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function CardHeader({
  className,
  ...props
}: ViewProps & React.RefAttributes<View>) {
  return (
    <View className={cn("flex flex-col gap-1.5 px-6", className)} {...props} />
  );
}

function CardTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      role="heading"
      aria-level={3}
      className={cn("font-semibold leading-none", className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  ...props
}: ViewProps & React.RefAttributes<View>) {
  return <View className={cn("px-6", className)} {...props} />;
}

function CardFooter({
  className,
  ...props
}: ViewProps & React.RefAttributes<View>) {
  return (
    <View
      className={cn("flex flex-row items-center px-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
export type { CardProps, CardVariant };
