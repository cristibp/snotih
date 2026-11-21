import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MarketQuote } from '../api/types';
import { useTheme } from '../theme/ThemeContext';

interface FavoriteCardProps {
  symbol: string;
  quote?: MarketQuote;
  isSelected: boolean;
  onSelect: (symbol: string) => void;
}

export default function FavoriteCard({
  symbol,
  quote,
  isSelected,
  onSelect,
}: FavoriteCardProps) {
  const { colors, isBlack } = useTheme();

  const price = quote?.price ?? 0;
  const change = quote?.change ?? 0;
  const changePercent = quote?.changePercent ?? 0;
  const isPositive = change >= 0;
  const currencySymbol = quote?.currency === 'EUR' ? '€' : quote?.currency === 'USD' ? '$' : '';

  const sourceBadge =
    quote?.source === 'finnhub' ? 'F' : quote?.source === 'yahoo' ? 'Y' : 'C';

  const sourceBadgeColor =
    quote?.source === 'finnhub' ? '#3B82F6' : quote?.source === 'yahoo' ? '#8B5CF6' : '#6B7280';

  const changeColor = isPositive ? '#10B981' : '#EF4444';
  const changeBg = isPositive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)';

  const formattedTime = quote?.timestamp
    ? new Date(quote.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const dayLow = quote?.low ?? 0;
  const dayHigh = quote?.high ?? 0;
  const hasRange = dayHigh > dayLow && dayLow > 0;
  const rangePercent = hasRange
    ? Math.min(100, Math.max(0, ((price - dayLow) / (dayHigh - dayLow)) * 100))
    : 50;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isSelected
            ? isBlack
              ? '#1E293B'
              : '#E2E8F0'
            : colors.card,
          borderColor: isSelected ? '#3B82F6' : colors.cardBorder,
        },
      ]}
      onPress={() => onSelect(symbol)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Selecteaza ${symbol}`}
    >
      <View style={styles.topRow}>
        <View style={styles.symbolContainer}>
          <Text
            style={[styles.symbolText, { color: colors.text }]}
            numberOfLines={1}
          >
            {symbol}
          </Text>
          <View style={[styles.sourceBadge, { backgroundColor: sourceBadgeColor }]}>
            <Text style={styles.sourceBadgeText}>{sourceBadge}</Text>
          </View>
          {formattedTime ? (
            <Text style={[styles.timeText, { color: colors.textMuted }]}>{formattedTime}</Text>
          ) : null}
        </View>

        <Text
          style={[styles.priceText, { color: colors.text }]}
          numberOfLines={1}
        >
          {price > 0 ? `${currencySymbol}${price.toFixed(2)}` : '...'}
        </Text>
      </View>

      {/* Mini graphical price-range bar for favorite */}
      {hasRange && (
        <View style={styles.miniRangeContainer}>
          <Text style={[styles.rangeBoundText, { color: colors.textMuted }]}>
            {dayLow.toFixed(1)}
          </Text>
          <View style={[styles.miniRangeTrack, { backgroundColor: isBlack ? '#334155' : '#E2E8F0' }]}>
            <View
              style={[
                styles.miniRangeFill,
                {
                  width: `${rangePercent}%`,
                  backgroundColor: isPositive ? '#10B981' : '#EF4444',
                },
              ]}
            />
            <View
              style={[
                styles.miniRangeThumb,
                {
                  left: `${rangePercent}%`,
                  backgroundColor: isPositive ? '#10B981' : '#EF4444',
                },
              ]}
            />
          </View>
          <Text style={[styles.rangeBoundText, { color: colors.textMuted }]}>
            {dayHigh.toFixed(1)}
          </Text>
        </View>
      )}

      <View style={styles.bottomRow}>
        <Text style={[styles.nameText, { color: colors.textMuted }]} numberOfLines={1}>
          {quote?.name || (symbol.includes('.') ? 'ETF / European' : 'US Stock')}
        </Text>

        <View style={[styles.changePill, { backgroundColor: changeBg }]}>
          <Text style={[styles.changeText, { color: changeColor }]}>
            {isPositive ? '+' : ''}
            {changePercent.toFixed(2)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 70,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    marginBottom: 5,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '65%',
  },
  symbolText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 9,
    marginLeft: 2,
  },
  sourceBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  miniRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 1,
  },
  rangeBoundText: {
    fontSize: 8,
    fontWeight: '600',
  },
  miniRangeTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
    justifyContent: 'center',
  },
  miniRangeFill: {
    height: 3,
    borderRadius: 2,
  },
  miniRangeThumb: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 10,
    maxWidth: '60%',
  },
  changePill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    minWidth: 48,
    alignItems: 'center',
  },
  changeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
