import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useSegments,
} from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VaultDetail } from "../../../../../../components/vault/VaultDetail";
import { FavoriteHeaderButton } from "../../../../../../components/vault/FavoriteHeaderButton";
import { useVault } from "../../../../../../hooks/queries/use-vaults";

export default function VaultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const segments = useSegments();
  const { data: vault } = useVault(id);

  const tabSegment = useMemo(
    () => segments.find((s) => ["(home)", "(profile)"].includes(s)) ?? "(home)",
    [segments],
  );

  const handleInvest = () =>
    router.push(`/(app)/(tabs)/${tabSegment}/vault/${id}/invest` as never);

  const handleWithdraw = () =>
    router.push(`/(app)/(tabs)/${tabSegment}/vault/${id}/withdraw` as never);

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Pressable
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/(app)/(tabs)/(home)")
                }
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
              </Pressable>
              <Text
                numberOfLines={1}
                style={{
                  color: "#F8FAFC",
                  fontSize: 16,
                  fontWeight: "600",
                  flexShrink: 1,
                  maxWidth: 180,
                }}
              >
                {vault?.name ?? ""}
              </Text>
              {vault && <FavoriteHeaderButton vaultId={id} />}
            </View>
          ),
          headerTitle: "",
          unstable_headerRightItems: () =>
            vault
              ? [
                  {
                    type: "menu" as const,
                    label: "Actions",
                    icon: { type: "sfSymbol" as const, name: "ellipsis.circle" },
                    menu: {
                      items: [
                        {
                          type: "action" as const,
                          label: "Invest",
                          icon: {
                            type: "sfSymbol" as const,
                            name: "arrow.up.circle",
                          },
                          onPress: handleInvest,
                        },
                        {
                          type: "action" as const,
                          label: "Withdraw",
                          icon: {
                            type: "sfSymbol" as const,
                            name: "arrow.down.circle",
                          },
                          onPress: handleWithdraw,
                        },
                      ],
                    },
                  },
                ]
              : [],
        }}
      />
      <VaultDetail
        vaultId={id}
        onInvest={handleInvest}
        onWithdraw={handleWithdraw}
        onViewAllUpdates={() =>
          router.push(
            `/(app)/(tabs)/${tabSegment}/vault/${id}/strategy-updates` as never,
          )
        }
      />
    </>
  );
}
