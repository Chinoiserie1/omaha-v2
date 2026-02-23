import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LineChartView } from "../../../../components/ui/LineChartView";

const SAMPLE_DATA = [
  { timestamp: 1704067200000, value: 42500 },
  { timestamp: 1704153600000, value: 43200 },
  { timestamp: 1704240000000, value: 41800 },
  { timestamp: 1704326400000, value: 44100 },
  { timestamp: 1704412800000, value: 43600 },
  { timestamp: 1704499200000, value: 45200 },
  { timestamp: 1704585600000, value: 44800 },
  { timestamp: 1704672000000, value: 46100 },
  { timestamp: 1704758400000, value: 45500 },
  { timestamp: 1704844800000, value: 47200 },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <View className="flex-1 p-5">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Profile
        </Text>
        <Text className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          Manage your account and preferences.
        </Text>

        <LineChartView
          data={SAMPLE_DATA}
          height={200}
          className="rounded-xl overflow-hidden"
        />
      </View>
    </SafeAreaView>
  );
}
