import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { G, Circle, Rect, Text as TextSVG, Line } from 'react-native-svg';
import { HistoryEntry } from '../api/types';

interface RateChartProps {
  title: string;
  history: HistoryEntry[];
  dataKey: 'eurRonBnr' | 'eurUsdYahoo';
  color: string;
  activeIndex: number | null;
  setActiveIndex: (index: number | null) => void;
}

const screenWidth = Dimensions.get('window').width;
const MAX_X_LABELS = 6;

export default function RateChart({
  title,
  history,
  dataKey,
  color,
  activeIndex,
  setActiveIndex,
}: RateChartProps) {
  if (history.length === 0) {
    return null;
  }

  // Folosim toate valorile din istoric pe grafic, dar afisam doar cateva
  // etichete pe axa X (altfel devin ilizibile cand istoricul creste).
  const step = Math.max(1, Math.ceil(history.length / MAX_X_LABELS));
  const labels = history.map((entry, idx) => (idx % step === 0 ? entry.date.slice(5) : ''));
  const values = history.map((entry) => entry[dataKey]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <LineChart
        data={{
          labels,
          datasets: [{ data: values }],
        }}
        width={screenWidth - 40}
        height={220}
        yAxisLabel=""
        yAxisSuffix=""
        renderDotContent={({ x, y, index }) => {
          const isActive = index === activeIndex;

          let tooltipComponent = null;
          if (isActive) {
            const chartWidth = screenWidth - 40;
            const boxWidth = 110;
            const boxHeight = 45;

            // Calculate X position to stay within the chart boundary
            let boxX = x - boxWidth / 2;
            if (boxX < 10) {
              boxX = 10;
            } else if (boxX + boxWidth > chartWidth - 10) {
              boxX = chartWidth - 10 - boxWidth;
            }

            // Calculate Y position (show below the point if it's too high, otherwise show above)
            let boxY = y - boxHeight - 10;
            if (boxY < 10) {
              boxY = y + 15;
            }

            tooltipComponent = (
              <G key={`tooltip-${index}`}>
                {/* Vertical line indicator */}
                <Line
                  x1={x}
                  y1={10}
                  x2={x}
                  y2={180}
                  stroke="#D1D5DB"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                {/* Highlighted active dot */}
                <Circle
                  cx={x}
                  cy={y}
                  r={6}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                {/* Tooltip Card */}
                <Rect
                  x={boxX}
                  y={boxY}
                  width={boxWidth}
                  height={boxHeight}
                  rx={8}
                  fill="#1F2937"
                  opacity={0.95}
                />
                <TextSVG
                  x={boxX + boxWidth / 2}
                  y={boxY + 16}
                  fill="#9CA3AF"
                  fontSize={10}
                  fontWeight="500"
                  textAnchor="middle"
                >
                  {history[index].date}
                </TextSVG>
                <TextSVG
                  x={boxX + boxWidth / 2}
                  y={boxY + 34}
                  fill="#FFFFFF"
                  fontSize={11}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {history[index][dataKey].toFixed(4)}
                </TextSVG>
              </G>
            );
          }

          return (
            <G key={`dot-group-${index}`}>
              {/* Custom standard dot */}
              <Circle
                cx={x}
                cy={y}
                r={4}
                fill="#FFFFFF"
                stroke={color}
                strokeWidth={1.5}
              />
              {/* Hover/Touch target overlay */}
              <Circle
                cx={x}
                cy={y}
                r={15}
                fill="transparent"
                // @ts-ignore
                onMouseEnter={() => {
                  setActiveIndex(index);
                }}
                // @ts-ignore
                onMouseLeave={() => {
                  setActiveIndex(null);
                }}
                onTouchStart={() => {
                  setActiveIndex(index);
                }}
              />
              {tooltipComponent}
            </G>
          );
        }}
        chartConfig={{
          backgroundColor: '#FFFFFF',
          backgroundGradientFrom: '#FFFFFF',
          backgroundGradientTo: '#FFFFFF',
          decimalPlaces: 4,
          color: () => color,
          labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
          propsForDots: { r: '0' },
          propsForBackgroundLines: { stroke: '#F0F0F0' },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1F23',
    marginBottom: 8,
  },
  chart: {
    borderRadius: 12,
  },
});
