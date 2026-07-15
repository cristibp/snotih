import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { HistoryEntry } from '../api/types';

interface RateChartProps {
  title: string;
  history: HistoryEntry[];
  dataKey: 'eurRonBnr' | 'eurUsdYahoo';
  color: string;
}

const screenWidth = Dimensions.get('window').width;
const MAX_X_LABELS = 6;

export default function RateChart({ title, history, dataKey, color }: RateChartProps) {
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
        chartConfig={{
          backgroundColor: '#FFFFFF',
          backgroundGradientFrom: '#FFFFFF',
          backgroundGradientTo: '#FFFFFF',
          decimalPlaces: 4,
          color: () => color,
          labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
          propsForDots: { r: '2' },
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
