import { View, useWindowDimensions } from "react-native";
import { memo, useCallback, useMemo } from "react";
import { LineChart } from "react-native-wagmi-charts";
import * as Haptics from "expo-haptics";
import { ChartSkeleton } from "./Skeleton";

interface DataPoint {
  timestamp: number;
  value: number;
}

interface LineChartViewProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  loading?: boolean;
  showCursor?: boolean;
  showTooltip?: boolean;
  showGradient?: boolean;
  className?: string;
}

export const LineChartView = memo(function LineChartView({
  data,
  width = 100,
  height = 100,
  color = "#10b981",
  loading = false,
  showCursor = true,
  showTooltip = true,
  showGradient = true,
  className = "",
}: LineChartViewProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const chartWidth = useMemo(
    () => Math.round((windowWidth * Math.min(Math.max(width, 0), 100)) / 100),
    [windowWidth, width],
  );

  const chartHeight = useMemo(
    () => Math.round((windowHeight * Math.min(Math.max(height, 0), 100)) / 100),
    [windowHeight, height],
  );

  const invokeHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  if (loading) {
    return (
      <ChartSkeleton
        width={chartWidth}
        height={chartHeight}
        className={className}
      />
    );
  }

  return (
    <View className={className} style={{ width: chartWidth, height: chartHeight }}>
      <LineChart.Provider data={data} onCurrentIndexChange={invokeHaptic}>
        <LineChart width={chartWidth} height={chartHeight}>
          <LineChart.Path color={color} width={2}>
            {showGradient && <LineChart.Gradient color={color} />}
          </LineChart.Path>
          {showCursor && (
            <LineChart.CursorCrosshair
              color={color}
              onActivated={invokeHaptic}
              onEnded={invokeHaptic}
            >
              {showTooltip && <LineChart.Tooltip />}
            </LineChart.CursorCrosshair>
          )}
        </LineChart>
      </LineChart.Provider>
    </View>
  );
});
