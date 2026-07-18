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
  const chartHistoryWithConversion = chartHistory.map((entry) => ({
    ...entry,
    ronToUsd100: entry.eurRonBnr > 0 ? (100 * entry.eurUsdYahoo) / entry.eurRonBnr : 0,
  }));
  const activeEntry = activeIndex !== null && chartHistoryWithConversion[activeIndex]
    ? chartHistoryWithConversion[activeIndex]
    : chartHistoryWithConversion.length > 0 
      ? chartHistoryWithConversion[chartHistoryWithConversion.length - 1]
      : null;

  // Find index in the full history to get the true previous day
  const fullIndex = activeEntry 
    ? history.findIndex((h) => h.date === activeEntry.date) 
    : -1;

  const prevEntry = fullIndex > 0 ? history[fullIndex - 1] : null;

  // Compute averages for the selected interval
  const avgEurRon = filteredHistory.length > 0
    ? filteredHistory.reduce((sum, h) => sum + h.eurRonBnr, 0) / filteredHistory.length
    : 0;

  const avgEurUsd = filteredHistory.length > 0
    ? filteredHistory.reduce((sum, h) => sum + h.eurUsdYahoo, 0) / filteredHistory.length
    : 0;

  const avgRonToUsd = filteredHistory.length > 0
    ? filteredHistory.reduce((sum, h) => {
        const conv = h.eurRonBnr > 0 ? (100 * h.eurUsdYahoo) / h.eurRonBnr : 0;
        return sum + conv;
      }, 0) / filteredHistory.length
    : 0;

  const dispEurRon = activeEntry ? activeEntry.eurRonBnr : (rates ? rates.eurRonBnr : 0);
  const dispEurUsd = activeEntry ? activeEntry.eurUsdYahoo : (rates ? rates.eurUsdYahoo : 0);
  const dispRonToUsd = activeEntry 
    ? (activeEntry.eurRonBnr > 0 ? (100 * activeEntry.eurUsdYahoo) / activeEntry.eurRonBnr : 0)
    : (rates && rates.eurRonBnr > 0 ? (100 * rates.eurUsdYahoo) / rates.eurRonBnr : 0);

  const prevEurRon = prevEntry ? prevEntry.eurRonBnr : null;
  const prevEurUsd = prevEntry ? prevEntry.eurUsdYahoo : null;
  const prevRonToUsd = prevEntry && prevEntry.eurRonBnr > 0 
    ? (100 * prevEntry.eurUsdYahoo) / prevEntry.eurRonBnr 
    : null;

  const RateComparison = ({ currentVal, prevVal, avgVal }: { currentVal: number; prevVal: number | null; avgVal: number }) => {
    let prevStr = 'Față de ieri: N/A';
    let prevColor = '#6B7280';
    if (prevVal !== null && prevVal > 0) {
      const diff = ((currentVal - prevVal) / prevVal) * 100;
      const sign = diff >= 0 ? '+' : '';
      const word = diff >= 0 ? 'apreciat' : 'depreciat';
      prevStr = `Față de ieri: ${sign}${diff.toFixed(2)}% (${word})`;
      prevColor = diff >= 0 ? '#10B981' : '#EF4444';
    }

    let avgStr = 'Față de medie: N/A';
    let avgColor = '#6B7280';
    if (avgVal > 0) {
      const diff = ((currentVal - avgVal) / avgVal) * 100;
      const sign = diff >= 0 ? '+' : '';
      const word = diff >= 0 ? 'apreciat' : 'depreciat';
      avgStr = `Față de medie: ${sign}${diff.toFixed(2)}% (${word})`;
      avgColor = diff >= 0 ? '#10B981' : '#EF4444';
    }

    return (
      <View style={styles.comparisonRow}>
        <Text style={[styles.comparisonText, { color: prevColor }]}>{prevStr}</Text>
        <Text style={[styles.comparisonText, { color: avgColor }]}>{avgStr}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Curs Valutar</Text>

      {isLoading && !rates && <ActivityIndicator size="large" color="#2E7D32" />}

      {error && <Text style={styles.error}>{error}</Text>}

      {(activeEntry || rates) && (
        <View style={styles.card}>
          <Text style={styles.date}>
            Data: {activeEntry ? activeEntry.date : rates?.date} 
            {activeIndex !== null ? ' (Selectat din grafic)' : ' (Cel mai recent)'}
          </Text>

          <View style={styles.rateBlock}>
            <View style={styles.row}>
              <Text style={styles.label}>EUR/RON (BNR)</Text>
              <Text style={styles.value}>{dispEurRon.toFixed(4)}</Text>
            </View>
            <RateComparison currentVal={dispEurRon} prevVal={prevEurRon} avgVal={avgEurRon} />
          </View>

          <View style={styles.rateBlock}>
            <View style={styles.row}>
              <Text style={styles.label}>EUR/USD</Text>
              <Text style={styles.value}>{dispEurUsd.toFixed(4)}</Text>
            </View>
            <RateComparison currentVal={dispEurUsd} prevVal={prevEurUsd} avgVal={avgEurUsd} />
          </View>

          <View style={styles.rateBlock}>
            <View style={styles.row}>
              <Text style={styles.label}>100 RON în USD</Text>
              <Text style={[styles.value, { color: '#8B5CF6' }]}>
                {dispRonToUsd.toFixed(2)} $
              </Text>
            </View>
            <RateComparison currentVal={dispRonToUsd} prevVal={prevRonToUsd} avgVal={avgRonToUsd} />
          </View>
        </View>
      )}


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
        history={chartHistoryWithConversion}
        dataKey="eurRonBnr"
        color="#2E7D32"
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />

      <RateChart
        title="Evolutie EUR/USD"
        history={chartHistoryWithConversion}
        dataKey="eurUsdYahoo"
        color="#1D4ED8"
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />

      <RateChart
        title="Evolutie Valoare 100 RON in USD"
        history={chartHistoryWithConversion}
        dataKey="ronToUsd100"
        color="#8B5CF6"
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />

      <MonthlyStatsList stats={monthlyStats} />
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
  rateBlock: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  comparisonText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
