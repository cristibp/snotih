import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WatchlistVolumeSummary } from '../api/types';
import { useTheme } from '../theme/ThemeContext';

interface WatchlistVolumeMetricsProps {
  timeframe: string;
  summary: WatchlistVolumeSummary | null;
  isLoading: boolean;
}

function formatVolume(volume: number | null): string {
  if (volume === null) return '—';
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}k`;
  return volume.toLocaleString('ro-RO', { maximumFractionDigits: 1 });
}

function formatDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

export default function WatchlistVolumeMetrics({ timeframe, summary, isLoading }: WatchlistVolumeMetricsProps) {
  const { colors, isBlack } = useTheme();
  if (timeframe !== '1D' && timeframe !== '5D') return null;

  const tileStyle = {
    backgroundColor: isBlack ? '#1E293B' : '#F1F5F9',
    borderColor: isBlack ? '#334155' : '#E2E8F0',
  };
  const renderMetric = (label: string, volume: number | null, key = label) => (
    <View key={key} style={[styles.metric, tileStyle]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[styles.value, { color: colors.text }]}
        accessibilityLabel={`${label}: ${volume === null ? 'indisponibil' : volume.toLocaleString('ro-RO')}`}
      >
        {formatVolume(volume)}
      </Text>
    </View>
  );

  const currentVolume = summary?.currentDay.volume ?? null;
  const average = summary?.average5d ?? null;
  const canCompare = currentVolume !== null && average !== null;
  const isAbove = canCompare && currentVolume > average;
  const comparisonLabel = !canCompare
    ? 'Comparație indisponibilă'
    : isAbove ? '▲ Peste medie' : currentVolume < average ? '▼ Sub medie' : '= La medie';
  const percent = canCompare && average > 0 ? ((currentVolume - average) / average) * 100 : null;

  return (
    <View style={[styles.section, { borderTopColor: colors.cardBorder }]}>
      <Text style={[styles.heading, { color: colors.textMuted }]}>
        {timeframe === '5D' ? 'Volum pe zi' : 'Volum zi vs. media celor 5 zile de tranzacționare precedente'}
      </Text>
      {isLoading || !summary ? (
        <Text style={[styles.message, { color: colors.textMuted }]}>
          {isLoading ? 'Se încarcă volumul…' : 'Volumul nu este disponibil.'}
        </Text>
      ) : timeframe === '5D' ? (
        <View style={styles.row}>
          {summary.daily.map((day) => renderMetric(formatDate(day.date), day.volume, day.date))}
        </View>
      ) : (
        <View style={styles.row}>
          {renderMetric(`Volum zi · ${formatDate(summary.currentDay.date)}`, currentVolume)}
          {renderMetric('Medie 5D', average)}
          <View style={[styles.metric, tileStyle, isAbove && styles.aboveAverage]}>
            <Text style={[styles.label, { color: isAbove ? (isBlack ? '#34D399' : '#047857') : colors.textMuted }]}>
              {comparisonLabel}
            </Text>
            <Text style={[styles.value, { color: isAbove ? (isBlack ? '#34D399' : '#047857') : colors.text }]}>
              {percent === null ? '—' : `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: 1, paddingTop: 6, marginTop: 6, minHeight: 72 },
  heading: { fontSize: 10, fontWeight: '600', marginBottom: 5 },
  row: { flexDirection: 'row', gap: 4, alignItems: 'stretch' },
  metric: {
    flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 7, paddingVertical: 5, paddingHorizontal: 3,
  },
  label: { fontSize: 9, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  value: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  aboveAverage: { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' },
  message: { fontSize: 11, paddingVertical: 10 },
});
