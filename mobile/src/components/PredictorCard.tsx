import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { BnrPredictorResult, IntradayAverageResult, MoneyMarketData } from '../api/types';
import { useTheme } from '../theme/ThemeContext';

interface PredictorCardProps {
  prediction: BnrPredictorResult | null;
  intradayAverage: IntradayAverageResult | null;
  moneyMarket: MoneyMarketData | null;
  isLoading?: boolean;
}

export default function PredictorCard({
  prediction,
  intradayAverage,
  moneyMarket,
  isLoading,
}: PredictorCardProps) {
  const { colors, isBlack } = useTheme();

  if (isLoading && !prediction && !intradayAverage) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderWidth: isBlack ? 1 : 0,
          },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Se analizează piața interbancară și semnalele CEE...
        </Text>
      </View>
    );
  }

  if (!prediction && !intradayAverage) {
    return null;
  }

  const isUp = prediction?.prediction === 'INCREASE';
  const isDown = prediction?.prediction === 'DECREASE';

  const badgeBg = isUp
    ? colors.tierOverboughtBg
    : isDown
    ? colors.tierOversoldBg
    : colors.tierNeutralBg;

  const badgeText = isUp
    ? colors.tierOverboughtText
    : isDown
    ? colors.tierOversoldText
    : colors.tierNeutralText;

  const diffSign = (intradayAverage?.diffFromPrevBnr ?? 0) >= 0 ? '+' : '';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          borderWidth: isBlack ? 1 : 0,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Text style={styles.headerIcon}>🔮</Text>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Predictor Curs BNR</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
              Fixing 13:00 bazat pe CEE & EUR/USD
            </Text>
          </View>
        </View>

        {prediction && (
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeText }]}>
              {prediction.directionIcon} {prediction.predictionLabel.split(' ')[0]}
            </Text>
          </View>
        )}
      </View>

      {/* Prediction Status Pill */}
      {prediction && (
        <View style={[styles.predictionBanner, { backgroundColor: colors.segmentBackground }]}>
          <Text style={[styles.predictionTitle, { color: colors.text }]}>
            Tendință: <Text style={{ color: badgeText, fontWeight: '700' }}>{prediction.predictionLabel}</Text>
          </Text>
          <Text style={[styles.confidenceText, { color: colors.textMuted }]}>
            Încredere: <Text style={{ color: colors.text, fontWeight: '600' }}>{prediction.confidencePercent}%</Text>
            {prediction.compositeScore !== undefined ? ` (Scor: ${(prediction.compositeScore >= 0 ? '+' : '') + prediction.compositeScore.toFixed(3)})` : ''}
          </Text>
        </View>
      )}

      {/* Sesiunea Interbancara RON / EUR (13:00 -> 09:00) */}
      {intradayAverage && (
        <View style={[styles.sectionBlock, { borderBottomColor: colors.divider }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              ⏱️ Media & Mediana RON / EUR (13:00 → 09:00)
            </Text>
            {intradayAverage.sampleCount > 0 && (
              <Text style={[styles.countBadge, { color: colors.textMuted }]}>
                {intradayAverage.sampleCount} cotații
              </Text>
            )}
          </View>

          <View style={styles.statsTwoColRow}>
            <View style={styles.statCol}>
              <Text style={[styles.statColLabel, { color: colors.textMuted }]}>Medie Sesiune</Text>
              <Text style={[styles.mainRate, { color: colors.primary }]}>
                {intradayAverage.avgEurRon.toFixed(4)}{' '}
                <Text style={styles.rateUnit}>RON</Text>
              </Text>
              <Text style={[styles.secondaryRate, { color: colors.textMuted }]}>
                1 RON = {intradayAverage.avgRonEur.toFixed(4)} EUR
              </Text>
              {intradayAverage.diffFromPrevBnr !== undefined && (
                <Text style={[styles.diffNote, { color: intradayAverage.diffFromPrevBnr >= 0 ? colors.danger : colors.success }]}>
                  {diffSign}{intradayAverage.diffFromPrevBnr.toFixed(4)} ({diffSign}{intradayAverage.pctFromPrevBnr?.toFixed(2)}%)
                </Text>
              )}
            </View>

            {intradayAverage.medianEurRon !== undefined && (
              <View style={styles.statCol}>
                <Text style={[styles.statColLabel, { color: colors.textMuted }]}>Mediană Sesiune</Text>
                <Text style={[styles.mainRate, { color: colors.accentBlue }]}>
                  {intradayAverage.medianEurRon.toFixed(4)}{' '}
                  <Text style={styles.rateUnit}>RON</Text>
                </Text>
                <Text style={[styles.secondaryRate, { color: colors.textMuted }]}>
                  1 RON = {(intradayAverage.medianRonEur ?? (1 / intradayAverage.medianEurRon)).toFixed(4)} EUR
                </Text>
                {intradayAverage.diffMedianFromPrevBnr !== undefined && (
                  <Text style={[styles.diffNote, { color: intradayAverage.diffMedianFromPrevBnr >= 0 ? colors.danger : colors.success }]}>
                    {(intradayAverage.diffMedianFromPrevBnr >= 0 ? '+' : '')}{intradayAverage.diffMedianFromPrevBnr.toFixed(4)} ({((intradayAverage.pctMedianFromPrevBnr ?? 0) >= 0 ? '+' : '')}{intradayAverage.pctMedianFromPrevBnr?.toFixed(2)}%)
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Semnale Piata CEE (EUR/PLN, EUR/HUF, EUR/USD overnight) */}
      {prediction?.signals && (
        <View style={[styles.sectionBlock, { borderBottomColor: colors.divider }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            📊 Semnale Matinale (09:00 - 11:30)
          </Text>

          <View style={styles.signalsGrid}>
            <View style={[styles.signalChip, { backgroundColor: colors.segmentBackground }]}>
              <Text style={[styles.signalLabel, { color: colors.textMuted }]}>EUR / PLN</Text>
              <Text
                style={[
                  styles.signalVal,
                  {
                    color:
                      prediction.signals.eurPln.percentChange >= 0
                        ? colors.danger
                        : colors.success,
                  },
                ]}
              >
                {prediction.signals.eurPln.formattedChange}
              </Text>
            </View>

            <View style={[styles.signalChip, { backgroundColor: colors.segmentBackground }]}>
              <Text style={[styles.signalLabel, { color: colors.textMuted }]}>EUR / HUF</Text>
              <Text
                style={[
                  styles.signalVal,
                  {
                    color:
                      prediction.signals.eurHuf.percentChange >= 0
                        ? colors.danger
                        : colors.success,
                  },
                ]}
              >
                {prediction.signals.eurHuf.formattedChange}
              </Text>
            </View>

            <View style={[styles.signalChip, { backgroundColor: colors.segmentBackground }]}>
              <Text style={[styles.signalLabel, { color: colors.textMuted }]}>EUR / USD Overnight</Text>
              <Text
                style={[
                  styles.signalVal,
                  {
                    color:
                      prediction.signals.eurUsdOvernight.percentChange >= 0
                        ? colors.accentBlue
                        : colors.danger,
                  },
                ]}
              >
                {prediction.signals.eurUsdOvernight.formattedChange}
              </Text>
            </View>

            {prediction.signals.ronEurDynamics && (
              <View style={[styles.signalChip, { backgroundColor: colors.segmentBackground }]}>
                <Text style={[styles.signalLabel, { color: colors.textMuted }]}>RON / EUR (Prag 0.20)</Text>
                <Text
                  style={[
                    styles.signalVal,
                    {
                      color:
                        prediction.signals.ronEurDynamics.percentChange >= 0
                          ? colors.success
                          : colors.danger,
                    },
                  ]}
                >
                  {prediction.signals.ronEurDynamics.formattedChange}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Abateri fata de Media si Mediana pe 30 zile */}
      {(prediction?.stats30Days || prediction?.signals?.ronEurDynamics?.devFrom30DaysMedianPercent !== undefined) && (
        <View style={[styles.sectionBlock, { borderBottomColor: colors.divider }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            📅 Abateri Ultimele 30 Zile (Medie & Mediană)
          </Text>

          <View style={styles.statsTwoColRow}>
            {/* EUR / RON */}
            {prediction?.stats30Days?.eurRon && (
              <View style={[styles.statCard, { backgroundColor: colors.segmentBackground }]}>
                <Text style={[styles.statColLabel, { color: colors.textMuted }]}>EUR / RON (BNR)</Text>
                <View style={styles.statMetricRow}>
                  <Text style={[styles.statMetricName, { color: colors.textMuted }]}>Medie:</Text>
                  <Text style={[styles.statMetricValue, { color: colors.text }]}>
                    {prediction.stats30Days.eurRon.average.toFixed(4)}{' '}
                    <Text style={{ color: prediction.stats30Days.eurRon.devFromAveragePercent >= 0 ? colors.danger : colors.success, fontWeight: '700' }}>
                      ({prediction.stats30Days.eurRon.formattedDevAverage})
                    </Text>
                  </Text>
                </View>
                <View style={styles.statMetricRow}>
                  <Text style={[styles.statMetricName, { color: colors.textMuted }]}>Mediană:</Text>
                  <Text style={[styles.statMetricValue, { color: colors.text }]}>
                    {prediction.stats30Days.eurRon.median.toFixed(4)}{' '}
                    <Text style={{ color: prediction.stats30Days.eurRon.devFromMedianPercent >= 0 ? colors.danger : colors.success, fontWeight: '700' }}>
                      ({prediction.stats30Days.eurRon.formattedDevMedian})
                    </Text>
                  </Text>
                </View>
              </View>
            )}

            {/* RON / EUR */}
            {(prediction?.stats30Days?.ronEur || prediction?.signals?.ronEurDynamics) && (
              <View style={[styles.statCard, { backgroundColor: colors.segmentBackground }]}>
                <Text style={[styles.statColLabel, { color: colors.textMuted }]}>RON / EUR (Putere Leu)</Text>
                <View style={styles.statMetricRow}>
                  <Text style={[styles.statMetricName, { color: colors.textMuted }]}>Medie:</Text>
                  <Text style={[styles.statMetricValue, { color: colors.text }]}>
                    {(prediction?.stats30Days?.ronEur?.average ?? prediction?.signals?.ronEurDynamics?.avg30DaysRonEur ?? 0).toFixed(4)}{' '}
                    <Text style={{ color: (prediction?.stats30Days?.ronEur?.devFromAveragePercent ?? prediction?.signals?.ronEurDynamics?.devFrom30DaysPercent ?? 0) >= 0 ? colors.success : colors.danger, fontWeight: '700' }}>
                      ({prediction?.stats30Days?.ronEur?.formattedDevAverage ?? `${(prediction?.signals?.ronEurDynamics?.devFrom30DaysPercent ?? 0) >= 0 ? '+' : ''}${(prediction?.signals?.ronEurDynamics?.devFrom30DaysPercent ?? 0).toFixed(2)}%`})
                    </Text>
                  </Text>
                </View>
                <View style={styles.statMetricRow}>
                  <Text style={[styles.statMetricName, { color: colors.textMuted }]}>Mediană:</Text>
                  <Text style={[styles.statMetricValue, { color: colors.text }]}>
                    {(prediction?.stats30Days?.ronEur?.median ?? prediction?.signals?.ronEurDynamics?.median30DaysRonEur ?? 0).toFixed(4)}{' '}
                    <Text style={{ color: (prediction?.stats30Days?.ronEur?.devFromMedianPercent ?? prediction?.signals?.ronEurDynamics?.devFrom30DaysMedianPercent ?? 0) >= 0 ? colors.success : colors.danger, fontWeight: '700' }}>
                      ({prediction?.stats30Days?.ronEur?.formattedDevMedian ?? `${(prediction?.signals?.ronEurDynamics?.devFrom30DaysMedianPercent ?? 0) >= 0 ? '+' : ''}${(prediction?.signals?.ronEurDynamics?.devFrom30DaysMedianPercent ?? 0).toFixed(2)}%`})
                    </Text>
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Piata Monetara (ROBOR & IRCC) */}
      {moneyMarket && (
        <View style={styles.moneyMarketBlock}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            🏦 Piața Monetară & Lichiditate
          </Text>

          <View style={styles.mmGrid}>
            <View style={styles.mmItem}>
              <Text style={[styles.mmLabel, { color: colors.textMuted }]}>ROBOR 3M</Text>
              <Text style={[styles.mmValue, { color: colors.text }]}>
                {moneyMarket.robor3M.toFixed(2)}%
              </Text>
            </View>

            <View style={styles.mmItem}>
              <Text style={[styles.mmLabel, { color: colors.textMuted }]}>ROBOR 6M</Text>
              <Text style={[styles.mmValue, { color: colors.text }]}>
                {(moneyMarket.robor6M ?? moneyMarket.robor3M + 0.05).toFixed(2)}%
              </Text>
            </View>

            <View style={styles.mmItem}>
              <Text style={[styles.mmLabel, { color: colors.textMuted }]}>IRCC (Trim.)</Text>
              <Text style={[styles.mmValue, { color: colors.text }]}>
                {moneyMarket.ircc.toFixed(2)}%
              </Text>
            </View>
          </View>

          <View style={styles.liquidityRow}>
            <Text style={[styles.liquidityBadge, { color: colors.primary, backgroundColor: colors.segmentBackground }]}>
              💧 {moneyMarket.liquidityCondition}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginTop: 20,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  loadingText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 13,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  predictionBanner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  predictionTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 12,
  },
  sectionBlock: {
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  countBadge: {
    fontSize: 11,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mainRate: {
    fontSize: 20,
    fontWeight: '700',
  },
  rateUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  secondaryRate: {
    fontSize: 13,
  },
  diffNote: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  statsTwoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCol: {
    flex: 1,
  },
  statColLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
  },
  statMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statMetricName: {
    fontSize: 11,
  },
  statMetricValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  signalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  signalChip: {
    flex: 1,
    padding: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  signalLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  signalVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  moneyMarketBlock: {
    paddingTop: 2,
  },
  mmGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mmItem: {
    flex: 1,
    alignItems: 'center',
  },
  mmLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  mmValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  liquidityRow: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  liquidityBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
