import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { useHistory } from '../hooks/useHistory';
import MonthlyStatsList from '../components/MonthlyStatsList';
import RateChart from '../components/RateChart';
import DropdownSelector, { DropdownOption } from '../components/DropdownSelector';
import { HistoryEntry } from '../api/types';

const INTERVAL_OPTIONS: DropdownOption[] = [
  { label: '1 Lună', value: '1m' },
  { label: '3 Luni', value: '3m' },
  { label: '6 Luni', value: '6m' },
  { label: '1 An', value: '1y' },
  { label: '5 Ani', value: '5y' },
  { label: '10 Ani', value: '10y' },
  { label: 'Tot istoricul', value: 'all' },
];

function filterHistory(data: HistoryEntry[], interval: string): HistoryEntry[] {
  if (interval === 'all') return data;

  const now = new Date();
  const cutoffDate = new Date();

  switch (interval) {
    case '1m':
      cutoffDate.setMonth(now.getMonth() - 1);
      break;
    case '3m':
      cutoffDate.setMonth(now.getMonth() - 3);
      break;
    case '6m':
      cutoffDate.setMonth(now.getMonth() - 6);
      break;
    case '1y':
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
    case '5y':
      cutoffDate.setFullYear(now.getFullYear() - 5);
      break;
    case '10y':
      cutoffDate.setFullYear(now.getFullYear() - 10);
      break;
    default:
      return data;
  }

  const cutoffStr = cutoffDate.toISOString().slice(0, 10);
  return data.filter((entry) => entry.date >= cutoffStr);
}

function downsampleData(data: HistoryEntry[], maxPoints = 80): HistoryEntry[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, idx) => idx % step === 0);
}

export default function HomeScreen() {
  const { rates, isLoading, error, refresh } = useExchangeRates();
  const { history, monthlyStats, refresh: refreshHistory } = useHistory();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<string>('1m');

  const [activeIndex, setActiveIndex] = useState<number | null>(null);


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshHistory()]);
    setRefreshing(false);
  }, [refresh, refreshHistory]);

  const filteredHistory = filterHistory(history, selectedInterval);
  const chartHistory = downsampleData(filteredHistory, 80);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Curs Valutar</Text>

      {isLoading && !rates && <ActivityIndicator size="large" color="#2E7D32" />}

      {error && <Text style={styles.error}>{error}</Text>}

      {rates && (
        <View style={styles.card}>
          <Text style={styles.date}>Data: {rates.date}</Text>

          <View style={styles.row}>
            <Text style={styles.label}>EUR/RON (BNR)</Text>
            <Text style={styles.value}>{rates.eurRonBnr.toFixed(4)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>EUR/USD</Text>
            <Text style={styles.value}>{rates.eurUsdYahoo.toFixed(4)}</Text>
          </View>
        </View>
      )}

      <MonthlyStatsList stats={monthlyStats} />

      <Text style={styles.sectionTitle}>Evoluție Grafice</Text>
      <DropdownSelector
        options={INTERVAL_OPTIONS}
        selectedValue={selectedInterval}
        onValueChange={(value) => {
          setSelectedInterval(value);
          setActiveIndex(null);
        }}
      />

      <RateChart
        title="Evolutie EUR/RON (BNR)"
        history={chartHistory}
        dataKey="eurRonBnr"
        color="#2E7D32"
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />

      <RateChart
        title="Evolutie EUR/USD"
        history={chartHistory}
        dataKey="eurUsdYahoo"
        color="#1D4ED8"
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />

      <Text style={styles.hint}>Trage in jos pentru actualizare manuala</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#F5F7FA',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    color: '#1B1F23',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B1F23',
    marginTop: 24,
    alignSelf: 'flex-start',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  label: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  value: {
    fontSize: 18,
    color: '#2E7D32',
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  hint: {
    marginTop: 20,
    color: '#9CA3AF',
    fontSize: 12,
  },
});
