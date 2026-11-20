import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useYieldCurve } from '../hooks/useYieldCurve';
import { RecessionRegime, SteepeningType } from '../api/types';
import { useTheme } from '../theme/ThemeContext';

export default function RecessionScreen() {
  const { colors, isBlack } = useTheme();
  const { data, isLoading, isRefreshing, error, refresh, reload } = useYieldCurve(30);

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#DC2626'; // Rosu critic
    if (score >= 50) return '#EA580C'; // Portocaliu
    if (score >= 25) return '#D97706'; // Galben / Chihlimbar
    return '#10B981'; // Verde
  };

  const getScoreBadgeText = (score: number) => {
    if (score >= 70) return 'RISC IMINENT (CRITIC)';
    if (score >= 50) return 'AVERTIZARE ACTIVĂ';
    if (score >= 25) return 'RISC MODERAT';
    return 'RISC MINIM';
  };

  const getRegimeBadgeColor = (regime?: RecessionRegime) => {
    switch (regime) {
      case 'UNINVERSION_CRITICAL':
        return '#DC2626';
      case 'INVERTED':
        return '#EA580C';
      case 'FLATTENING':
        return '#D97706';
      case 'NORMAL':
      default:
        return '#10B981';
    }
  };

  const formatBps = (val?: number) => {
    if (val === undefined || val === null) return '--';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)} bps`;
  };

  const formatSteepeningLabel = (type?: SteepeningType) => {
    switch (type) {
      case 'BULL_STEEPENER':
        return 'Bull Steepener 🐂';
      case 'BEAR_STEEPENER':
        return 'Bear Steepener 🐻';
      case 'NEUTRAL':
      default:
        return 'Neutru / Stabil ⚖️';
    }
  };

  const formatSteepeningDesc = (type?: SteepeningType) => {
    switch (type) {
      case 'BULL_STEEPENER':
        return 'Randamentele pe termen scurt scad mai repede decât cele lungi (relaxare monetară / tăieri Fed).';
      case 'BEAR_STEEPENER':
        return 'Randamentele lungi cresc mai repede decât cele scurte (presiuni inflaționiste / primă de risc).';
      case 'NEUTRAL':
      default:
        return 'Panta curbei este relativ constantă pe orizontul ultimelor 20 de zile lucrătoare.';
    }
  };

  if (isLoading && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Se descarcă și se calculează indicatorii FRED...
        </Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.danger }]}>Eroare la încărcare</Text>
        <Text style={[styles.errorDescription, { color: colors.textMuted }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => reload(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>Reîncearcă</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const score = data?.score ?? 0;
  const scoreColor = getScoreColor(score);
  const current = data?.current;
  const components = data?.components;
  const regime = data?.regime;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Recession Proximity</Text>
          <TouchableOpacity
            style={[styles.refreshPill, { backgroundColor: colors.segmentBackground, borderColor: colors.border }]}
            onPress={refresh}
            activeOpacity={0.7}
          >
            <Text style={[styles.refreshPillText, { color: colors.primary }]}>🔄 Refresh FRED</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          Model cantitativ compus bazat pe spread-urile Trezoreriei SUA (T10Y2Y & T10Y3M)
        </Text>
      </View>

      {/* Warning banner if cached fallback was used */}
      {data?.warning ? (
        <View style={[styles.warningBox, { backgroundColor: colors.errorBoxBg, borderColor: colors.errorBoxBorder }]}>
          <Text style={[styles.warningText, { color: colors.errorBoxText }]}>⚠️ {data.warning}</Text>
        </View>
      ) : null}

      {/* Main Score Gauge Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.scoreTopRow}>
          <View>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>
              RECESSION PROXIMITY SCORE
            </Text>
            <View style={styles.scoreNumberRow}>
              <Text style={[styles.scoreBigNumber, { color: scoreColor }]}>{score}</Text>
              <Text style={[styles.scoreScaleMax, { color: colors.textSubtle }]}>/ 100</Text>
            </View>
          </View>

          <View style={[styles.scoreBadge, { backgroundColor: `${scoreColor}1A`, borderColor: scoreColor }]}>
            <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>
              {getScoreBadgeText(score)}
            </Text>
          </View>
        </View>

        {/* Progress Bar with milestone ticks */}
        <View style={styles.progressBarWrapper}>
          <View style={[styles.progressBarTrack, { backgroundColor: colors.progressBarBg }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(100, Math.max(4, score))}%`, backgroundColor: scoreColor },
              ]}
            />
          </View>

          {/* Scale Labels */}
          <View style={styles.scaleLabelsRow}>
            <Text style={[styles.scaleText, { color: colors.textSubtle }]}>0 (Normal)</Text>
            <Text style={[styles.scaleText, { color: colors.textSubtle }]}>25 (Aplatizare)</Text>
            <Text style={[styles.scaleText, { color: colors.textSubtle }]}>50 (Inversat)</Text>
            <Text style={[styles.scaleText, { color: colors.textSubtle }]}>70+ (Critic)</Text>
          </View>
        </View>
      </View>

      {/* Regime Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: getRegimeBadgeColor(regime),
            borderLeftWidth: 5,
          },
        ]}
      >
        <View style={styles.regimeHeaderRow}>
          <View style={styles.regimeTitleWrapper}>
            <Text style={[styles.regimeLabelTitle, { color: colors.textMuted }]}>REGIM CURENT</Text>
            <Text style={[styles.regimeName, { color: colors.text }]}>
              {data?.regimeLabel || regime}
            </Text>
          </View>
          <View
            style={[
              styles.regimePill,
              { backgroundColor: `${getRegimeBadgeColor(regime)}20` },
            ]}
          >
            <Text style={[styles.regimePillText, { color: getRegimeBadgeColor(regime) }]}>
              Regim {data?.regimeNumber ?? 0}
            </Text>
          </View>
        </View>
        <Text style={[styles.regimeDescription, { color: colors.textMuted }]}>
          {data?.description}
        </Text>
      </View>

      {/* Key Metric Cards */}
      <View style={styles.kpiGrid}>
        {/* Card 1: 10Y - 3M Spread */}
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.kpiTopRow}>
            <Text style={[styles.kpiTitle, { color: colors.textMuted }]}>Spread 10Y – 3M</Text>
            <Text
              style={[
                styles.kpiStatusPill,
                {
                  color: (current?.t10y3m_bps ?? 0) < 0 ? '#DC2626' : '#10B981',
                  backgroundColor: (current?.t10y3m_bps ?? 0) < 0 ? '#FEE2E2' : '#D1FAE5',
                },
              ]}
            >
              {(current?.t10y3m_bps ?? 0) < 0 ? 'Inversat' : 'Pozitiv'}
            </Text>
          </View>
          <Text
            style={[
              styles.kpiValue,
              { color: (current?.t10y3m_bps ?? 0) < 0 ? '#DC2626' : colors.text },
            ]}
          >
            {formatBps(current?.t10y3m_bps)}
          </Text>
          <View style={styles.kpiDetailsList}>
            <Text style={[styles.kpiDetailItem, { color: colors.textMuted }]}>
              SMA5: <Text style={{ color: colors.text, fontWeight: '600' }}>{formatBps(current?.sma5_10y3m)}</Text>
            </Text>
            <Text style={[styles.kpiDetailItem, { color: colors.textMuted }]}>
              Delta 20z: <Text style={{ color: colors.text, fontWeight: '600' }}>{formatBps(current?.delta_20d_10y3m)}</Text>
            </Text>
            <Text style={[styles.kpiDetailItem, { color: colors.textMuted }]}>
              Delta 60z: <Text style={{ color: colors.text, fontWeight: '600' }}>{formatBps(current?.delta_60d_10y3m)}</Text>
            </Text>
            <Text style={[styles.kpiDetailItem, { color: colors.textMuted }]}>
              Ultima inversare:{' '}
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {current?.days_since_last_inversion_3m !== null && current?.days_since_last_inversion_3m !== undefined
                  ? `${current.days_since_last_inversion_3m} zile lucratoare`
                  : 'Niciuna în 400z'}
              </Text>
            </Text>
          </View>
        </View>

        {/* Card 2: 10Y - 2Y Spread */}
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.kpiTopRow}>
            <Text style={[styles.kpiTitle, { color: colors.textMuted }]}>Spread 10Y – 2Y</Text>
            <Text
              style={[
                styles.kpiStatusPill,
                {
                  color: (current?.t10y2y_bps ?? 0) < 0 ? '#DC2626' : '#10B981',
                  backgroundColor: (current?.t10y2y_bps ?? 0) < 0 ? '#FEE2E2' : '#D1FAE5',
                },
              ]}
            >
              {(current?.t10y2y_bps ?? 0) < 0 ? 'Inversat' : 'Pozitiv'}
            </Text>
          </View>
          <Text
            style={[
              styles.kpiValue,
              { color: (current?.t10y2y_bps ?? 0) < 0 ? '#DC2626' : colors.text },
            ]}
          >
            {formatBps(current?.t10y2y_bps)}
          </Text>
          <View style={styles.kpiDetailsList}>
            <Text style={[styles.kpiDetailItem, { color: colors.textMuted }]}>
              SMA5: <Text style={{ color: colors.text, fontWeight: '600' }}>{formatBps(current?.sma5_10y2y)}</Text>
            </Text>
            <Text style={[styles.kpiDetailItem, { color: colors.textMuted }]}>
              Status SMA5:{' '}
              <Text
                style={{
                  color: current?.is_inverted_2y ? '#DC2626' : '#10B981',
                  fontWeight: '600',
                }}
              >
                {current?.is_inverted_2y ? 'Inversat (< 0)' : 'Normal (>= 0)'}
              </Text>
            </Text>
            <Text style={[styles.kpiDetailItem, { color: colors.textMuted }]}>
              Ultima inversare:{' '}
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {current?.days_since_last_inversion_2y !== null && current?.days_since_last_inversion_2y !== undefined
                  ? `${current.days_since_last_inversion_2y} zile lucratoare`
                  : 'Niciuna în 400z'}
              </Text>
            </Text>
          </View>
        </View>

        {/* Card 3: Steepening Type */}
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.kpiTitle, { color: colors.textMuted }]}>Tip Accentuate (Steepening)</Text>
          <Text style={[styles.kpiSubValue, { color: colors.text }]}>
            {formatSteepeningLabel(current?.steepening_type)}
          </Text>
          <Text style={[styles.kpiDescText, { color: colors.textMuted }]}>
            {formatSteepeningDesc(current?.steepening_type)}
          </Text>
          {current?.dgs10 !== undefined && (
            <View style={styles.yieldsRow}>
              <Text style={[styles.yieldBadge, { backgroundColor: colors.segmentBackground, color: colors.text }]}>
                10Y: {current.dgs10}%
              </Text>
              {current?.dgs2 !== undefined && (
                <Text style={[styles.yieldBadge, { backgroundColor: colors.segmentBackground, color: colors.text }]}>
                  2Y: {current.dgs2}%
                </Text>
              )}
              {current?.dgs3mo !== undefined && (
                <Text style={[styles.yieldBadge, { backgroundColor: colors.segmentBackground, color: colors.text }]}>
                  3M: {current.dgs3mo}%
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Sub-Score Components Breakdown */}
      {components ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.text }]}>
            Descompunere Ponderată a Scorului
          </Text>
          <Text style={[styles.cardSectionSubtitle, { color: colors.textMuted }]}>
            Formula quant calculează probabilitatea pe 3 axe complementare:
          </Text>

          <View style={styles.componentsList}>
            {/* 40% T10Y3M */}
            <View style={styles.componentRow}>
              <View style={styles.componentLabelCol}>
                <Text style={[styles.componentName, { color: colors.text }]}>T10Y3M (Nivel & Istoric)</Text>
                <Text style={[styles.componentWeight, { color: colors.textSubtle }]}>
                  Pondere {(components.weight3m * 100).toFixed(0)}%
                </Text>
              </View>
              <Text style={[styles.componentScoreVal, { color: getScoreColor(components.score3m) }]}>
                {components.score3m} / 100
              </Text>
            </View>

            {/* 25% T10Y2Y */}
            <View style={styles.componentRow}>
              <View style={styles.componentLabelCol}>
                <Text style={[styles.componentName, { color: colors.text }]}>T10Y2Y (Nivel & Istoric)</Text>
                <Text style={[styles.componentWeight, { color: colors.textSubtle }]}>
                  Pondere {(components.weight2y * 100).toFixed(0)}%
                </Text>
              </View>
              <Text style={[styles.componentScoreVal, { color: getScoreColor(components.score2y) }]}>
                {components.score2y} / 100
              </Text>
            </View>

            {/* 35% Steepening / Uninversion */}
            <View style={styles.componentRow}>
              <View style={styles.componentLabelCol}>
                <Text style={[styles.componentName, { color: colors.text }]}>
                  Dezinversare & Steepening
                </Text>
                <Text style={[styles.componentWeight, { color: colors.textSubtle }]}>
                  Pondere {(components.weightSteepening * 100).toFixed(0)}%
                </Text>
              </View>
              <Text style={[styles.componentScoreVal, { color: getScoreColor(components.scoreSteepening) }]}>
                {components.scoreSteepening} / 100
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Historical Series Table */}
      {data?.history && data.history.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardSectionTitle, { color: colors.text }]}>
            Istoric Observații Recente (Zile Lucrătoare)
          </Text>
          <Text style={[styles.cardSectionSubtitle, { color: colors.textMuted }]}>
            Ultimele {Math.min(10, data.history.length)} sesiuni înregistrate de FRED:
          </Text>

          <View style={styles.historyTable}>
            <View style={[styles.tableHeaderRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableHeadCell, { color: colors.textMuted, flex: 1.2 }]}>Data</Text>
              <Text style={[styles.tableHeadCell, { color: colors.textMuted, flex: 1 }]}>10Y-3M</Text>
              <Text style={[styles.tableHeadCell, { color: colors.textMuted, flex: 1 }]}>10Y-2Y</Text>
              <Text style={[styles.tableHeadCell, { color: colors.textMuted, flex: 1 }]}>SMA5 3M</Text>
            </View>

            {data.history
              .slice(-10)
              .reverse()
              .map((obs) => (
                <View
                  key={obs.date}
                  style={[styles.tableRow, { borderBottomColor: colors.divider }]}
                >
                  <Text style={[styles.tableCell, { color: colors.text, flex: 1.2, fontWeight: '500' }]}>
                    {obs.date}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      {
                        flex: 1,
                        color: obs.t10y3m_bps < 0 ? '#DC2626' : '#10B981',
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {formatBps(obs.t10y3m_bps)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      {
                        flex: 1,
                        color: obs.t10y2y_bps < 0 ? '#DC2626' : '#10B981',
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {formatBps(obs.t10y2y_bps)}
                  </Text>
                  <Text style={[styles.tableCell, { color: colors.textMuted, flex: 1 }]}>
                    {formatBps(obs.sma5_10y3m)}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      ) : null}

      {/* Educational & Quantitative Context Card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.cardSectionTitle, { color: colors.text }]}>
          💡 De ce este dezinversarea momentul critic?
        </Text>
        <Text style={[styles.eduText, { color: colors.textMuted }]}>
          În analiza cantitativă a ciclurilor economice americane din ultimii 50 de ani:
        </Text>
        <Text style={[styles.eduBullet, { color: colors.textMuted }]}>
          • <Text style={{ fontWeight: '700', color: colors.text }}>Inversarea curbei (spread &lt; 0):</Text> Reprezintă un semnal timpuriu că politica monetară este restrictivă. Totuși, recesiunea nu începe de obicei în timpul inversării.
        </Text>
        <Text style={[styles.eduBullet, { color: colors.textMuted }]}>
          • <Text style={{ fontWeight: '700', color: '#DC2626' }}>Dezinversarea rapidă (trecere în &gt;= 0):</Text> Are loc atunci când Federal Reserve începe să reducă dobânzile în mod forțat pe fondul slăbirii economiei (Bull Steepener). Acesta este momentul în care riscul de recesiune devine iminent (scor &gt;= 70).
        </Text>
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSubtle }]}>
          Date preluate de la St. Louis Fed (FRED) • Fără bază de date • Cache memorie: 6h
        </Text>
        {data?.lastUpdated ? (
          <Text style={[styles.footerText, { color: colors.textSubtle, marginTop: 4 }]}>
            Ultimul calcul:{' '}
            {new Date(data.lastUpdated).toLocaleString('ro-RO', {
              timeZone: 'Europe/Bucharest',
            })}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  errorDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    marginBottom: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  refreshPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  refreshPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  warningBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  scoreNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  scoreBigNumber: {
    fontSize: 42,
    fontWeight: '900',
  },
  scoreScaleMax: {
    fontSize: 18,
    fontWeight: '600',
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  progressBarWrapper: {
    marginTop: 4,
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  scaleLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  scaleText: {
    fontSize: 10,
    fontWeight: '500',
  },
  regimeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  regimeTitleWrapper: {
    flex: 1,
  },
  regimeLabelTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  regimeName: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  regimePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  regimePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  regimeDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  kpiGrid: {
    gap: 12,
  },
  kpiCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  kpiTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  kpiStatusPill: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  kpiSubValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },
  kpiDescText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  kpiDetailsList: {
    gap: 4,
  },
  kpiDetailItem: {
    fontSize: 12,
  },
  yieldsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  yieldBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSectionSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  componentsList: {
    gap: 10,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  componentLabelCol: {
    flex: 1,
  },
  componentName: {
    fontSize: 13,
    fontWeight: '600',
  },
  componentWeight: {
    fontSize: 11,
    marginTop: 2,
  },
  componentScoreVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  historyTable: {
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  tableHeadCell: {
    fontSize: 11,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tableCell: {
    fontSize: 12,
  },
  eduText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  eduBullet: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  footer: {
    alignItems: 'center',
    marginTop: 6,
  },
  footerText: {
    fontSize: 11,
    textAlign: 'center',
  },
});
