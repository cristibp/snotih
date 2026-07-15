import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MonthlyStat } from '../api/types';

interface MonthlyStatsListProps {
  stats: MonthlyStat[];
}

const MONTH_NAMES = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES[idx] ?? m} ${year}`;
}

export default function MonthlyStatsList({ stats }: MonthlyStatsListProps) {
  if (stats.length === 0) {
    return null;
  }

  // Afisam lunile in ordine descrescatoare (cea mai recenta prima).
  const orderedStats = [...stats].reverse();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minim / Maxim pe luni</Text>

      {orderedStats.map((stat) => (
        <View key={stat.month} style={styles.monthBlock}>
          <Text style={styles.monthLabel}>{formatMonth(stat.month)}</Text>

          <View style={styles.currencyBlock}>
            <Text style={styles.currencyLabel}>EUR/RON</Text>
            <Text style={styles.extremeText}>
              Min: {stat.eurRonBnr.min.value.toFixed(4)} ({stat.eurRonBnr.min.date})
            </Text>
            <Text style={styles.extremeText}>
              Max: {stat.eurRonBnr.max.value.toFixed(4)} ({stat.eurRonBnr.max.date})
            </Text>
          </View>

          <View style={styles.currencyBlock}>
            <Text style={styles.currencyLabel}>EUR/USD</Text>
            <Text style={styles.extremeText}>
              Min: {stat.eurUsdYahoo.min.value.toFixed(4)} ({stat.eurUsdYahoo.min.date})
            </Text>
            <Text style={styles.extremeText}>
              Max: {stat.eurUsdYahoo.max.value.toFixed(4)} ({stat.eurUsdYahoo.max.date})
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1F23',
    marginBottom: 12,
  },
  monthBlock: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  currencyBlock: {
    marginLeft: 8,
    marginBottom: 4,
  },
  currencyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  extremeText: {
    fontSize: 13,
    color: '#4B5563',
  },
});
