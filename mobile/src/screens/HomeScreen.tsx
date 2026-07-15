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

export default function HomeScreen() {
  const { rates, isLoading, error, refresh } = useExchangeRates();
  const { history, monthlyStats, refresh: refreshHistory } = useHistory();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshHistory()]);
    setRefreshing(false);
  }, [refresh, refreshHistory]);

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

      <RateChart
        title="Evolutie EUR/RON (BNR)"
        history={history}
        dataKey="eurRonBnr"
        color="#2E7D32"
      />

      <RateChart
        title="Evolutie EUR/USD"
        history={history}
        dataKey="eurUsdYahoo"
        color="#1D4ED8"
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
