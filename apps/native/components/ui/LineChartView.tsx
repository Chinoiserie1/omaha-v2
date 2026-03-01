import { View, type LayoutChangeEvent } from "react-native";
import { memo, useCallback, useMemo, useState } from "react";
import { LineChart } from "react-native-wagmi-charts";
import * as Haptics from "expo-haptics";
import { ChartSkeleton } from "./Skeleton";

interface DataPoint {
  timestamp: number;
  value: number;
}

interface LineChartViewProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  loading?: boolean;
  showCursor?: boolean;
  showTooltip?: boolean;
  showGradient?: boolean;
  className?: string;
}

function invokeHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export const LineChartView = memo(function LineChartView({
  data,
  height = 100,
  color = "#10b981",
  loading = false,
  showCursor = true,
  showTooltip = true,
  showGradient = true,
  className = "",
}: LineChartViewProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const chartHeight = height;
  const tooltipTextStyle = useMemo(() => ({ color: "#ffffff" }), []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(Math.round(e.nativeEvent.layout.width));
  }, []);

  const onCurrentIndexChange = useCallback(
    (index: number) => {
      invokeHaptic();
      if (index >= 0 && index < data.length) {
        // Price callback can be added here
      }
    },
    [data],
  );

  if (loading || containerWidth === 0) {
    return (
      <View className={className} onLayout={onLayout} style={{ height: chartHeight }}>
        {loading && (
          <ChartSkeleton
            {...(containerWidth > 0 && { width: containerWidth })}
            height={chartHeight}
          />
        )}
      </View>
    );
  }

  return (
    <View className={className} onLayout={onLayout} style={{ height: chartHeight, backgroundColor: "transparent" }}>
      <LineChart.Provider data={data} onCurrentIndexChange={onCurrentIndexChange}>
        <LineChart height={chartHeight} width={containerWidth} style={{ backgroundColor: "transparent" }}>
          <LineChart.Path color={color}>
            {showGradient && <LineChart.Gradient />}
          </LineChart.Path>
          {showCursor && (
            <>
              <LineChart.CursorLine />
              <LineChart.CursorCrosshair
                color="grey"
                minDurationMs={200}
                snapToPoint
                onActivated={invokeHaptic}
                onEnded={invokeHaptic}
              >
                {showTooltip && <LineChart.Tooltip textStyle={tooltipTextStyle} />}
              </LineChart.CursorCrosshair>
            </>
          )}
        </LineChart>
      </LineChart.Provider>
    </View>
  );
});
