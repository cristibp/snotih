import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { G, Circle, Rect, Text as TextSVG, Line } from 'react-native-svg';
import { HistoryEntry } from '../api/types';

interface RateChartProps {
  title: string;
  history: (HistoryEntry & { ronToUsd100?: number })[];
  dataKey: 'eurRonBnr' | 'eurUsdYahoo' | 'ronToUsd100';
  color: string;
  activeIndex: number | null;
  setActiveIndex: (index: number | null) => void;
}

const screenWidth = Dimensions.get('window').width;
const MAX_X_LABELS = 6;

function getYCoordinate(v: number, values: number[], height: number = 220, paddingTop: number = 16): number {
  const validValues = values.filter((val) => typeof val === 'number' && isFinite(val));
  if (validValues.length === 0) return 0;
  
  const max = Math.max(...validValues);
  const min = Math.min(...validValues);
  const scaler = max - min || 1;
  
  let baseHeight = height;
  if (min >= 0 && max >= 0) {
    baseHeight = height;
  } else if (min < 0 && max <= 0) {
    baseHeight = 0;
  } else if (min < 0 && max > 0) {
    baseHeight = (height * max) / scaler;
  }
  
  let calcHeightVal = 0;
  if (min < 0 && max > 0) {
    calcHeightVal = height * (v / scaler);
  } else if (min >= 0 && max >= 0) {
    calcHeightVal = height * ((v - min) / scaler);
  } else if (min < 0 && max <= 0) {
    calcHeightVal = height * ((v - max) / scaler);
  }
  
  return ((baseHeight - calcHeightVal) / 4) * 3 + paddingTop;
}

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
  const values = history.map((entry) => entry[dataKey] ?? 0);

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
            const boxWidth = 175;
            const boxHeight = 92;

            // Calculate X position to stay within the chart boundary
            let boxX = x - boxWidth / 2;
            if (boxX < 10) {
              boxX = 10;
            } else if (boxX + boxWidth > chartWidth - 10) {
              boxX = chartWidth - 10 - boxWidth;
            }

            // Calculate Y position (show below the point if it's too high, otherwise show above)
            let boxY = y - boxHeight - 12;
            if (boxY < 10) {
              boxY = y + 18;
            }

            const currentVal = values[index] ?? 0;
            const prevVal = index > 0 ? (values[index - 1] ?? 0) : null;
            const average = values.reduce((sum, val) => sum + val, 0) / values.length;

            let changePrevStr = 'Ieri: N/A';
            let changePrevColor = '#9CA3AF';
            if (prevVal !== null && prevVal > 0) {
              const diff = ((currentVal - prevVal) / prevVal) * 100;
              const sign = diff >= 0 ? '+' : '';
              const word = diff >= 0 ? 'aprec.' : 'deprec.';
              changePrevStr = `Ieri: ${sign}${diff.toFixed(2)}% (${word})`;
              changePrevColor = diff >= 0 ? '#10B981' : '#EF4444';
            }

            let changeAvgStr = 'Medie: N/A';
            let changeAvgColor = '#9CA3AF';
            if (average > 0) {
              const diff = ((currentVal - average) / average) * 100;
              const sign = diff >= 0 ? '+' : '';
              const word = diff >= 0 ? 'aprec.' : 'deprec.';
              changeAvgStr = `Medie: ${sign}${diff.toFixed(2)}% (${word})`;
              changeAvgColor = diff >= 0 ? '#10B981' : '#EF4444';
            }

            tooltipComponent = (
              <G key={`tooltip-${index}`} pointerEvents="none">
                {/* Vertical line indicator */}
                <Line
                  x1={x}
                  y1={10}
                  x2={x}
                  y2={180}
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                {/* Highlighted active dot */}
                <Circle
                  cx={x}
                  cy={y}
                  r={7}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                />
                {/* Tooltip Card background with accent border */}
                <Rect
                  x={boxX}
                  y={boxY}
                  width={boxWidth}
                  height={boxHeight}
                  rx={10}
                  fill="#0F172A"
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.98}
                />
                {/* Date */}
                <TextSVG
                  x={boxX + boxWidth / 2}
                  y={boxY + 18}
                  fill="#94A3B8"
                  fontSize={11}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {history[index].date}
                </TextSVG>
                {/* Value */}
                <TextSVG
                  x={boxX + boxWidth / 2}
                  y={boxY + 38}
                  fill="#FFFFFF"
                  fontSize={16}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {currentVal.toFixed(4)}
                </TextSVG>
                {/* Separator line inside tooltip */}
                <Line
                  x1={boxX + 12}
                  y1={boxY + 46}
                  x2={boxX + boxWidth - 12}
                  y2={boxY + 46}
                  stroke="#334155"
                  strokeWidth={1}
                />
                {/* Change vs Yesterday */}
                <TextSVG
                  x={boxX + boxWidth / 2}
                  y={boxY + 63}
                  fill={changePrevColor}
                  fontSize={11}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {changePrevStr}
                </TextSVG>
                {/* Change vs Average */}
                <TextSVG
                  x={boxX + boxWidth / 2}
                  y={boxY + 80}
                  fill={changeAvgColor}
                  fontSize={11}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {changeAvgStr}
                </TextSVG>
              </G>
            );
          }

          const chartWidth = screenWidth - 40;
          const colWidth = values.length > 1 ? Math.max(8, chartWidth / values.length) : 40;

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
                pointerEvents="none"
              />
              {/* Hover/Touch target overlay */}
              <Rect
                x={x - colWidth / 2}
                y={0}
                width={colWidth}
                height={220}
                fill="rgba(0,0,0,0)"
                // @ts-ignore
                pointerEvents="all"
                // @ts-ignore
                onMouseEnter={() => {
                  setActiveIndex(index);
                }}
                // @ts-ignore
                onMouseMove={() => {
                  setActiveIndex(index);
                }}
                // @ts-ignore
                onMouseLeave={() => {
                  if (activeIndex === index) {
                    setActiveIndex(null);
                  }
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
        decorator={() => {
          const average = values.reduce((sum, val) => sum + val, 0) / values.length;
          const y = getYCoordinate(average, values, 220, 16);
          const xStart = 64; // default paddingRight
          const xEnd = screenWidth - 40;
          return (
            <G key="average-line-group">
              <Line
                x1={xStart}
                y1={y}
                x2={xEnd}
                y2={y}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                opacity={0.8}
              />
              <TextSVG
                x={xStart + 10}
                y={y - 6}
                fill={color}
                fontSize={10}
                fontWeight="bold"
              >
                Avg: {average.toFixed(4)}
              </TextSVG>
            </G>
          );
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
