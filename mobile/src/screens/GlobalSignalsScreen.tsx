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
import { useGlobalSignals } from '../hooks/useGlobalSignals';
import { GlobalMarketSignal, SignalImpact } from '../api/types';
import { useTheme } from '../theme/ThemeContext';
import buildInfo from '../constants/buildInfo.json';

interface GlobalSignalsScreenProps {
  isActive?: boolean;
}

export default function GlobalSignalsScreen({ isActive = true }: GlobalSignalsScreenProps) {
  const { colors, isBlack } = useTheme();
  const {
    data,
    isLoading,
    isRefreshing,
    isSendingDiscord,
    isCheckingOnly,
    discordStatus,
    error,
    refresh,
    sendDiscordReport,
    checkSignalsOnly,
  } = useGlobalSignals(isActive);
  const isActionBusy = isSendingDiscord || isCheckingOnly;

  const getImpactBadge = (impact: SignalImpact) => {
    switch (impact) {
      case 'POSITIVE':
        return {
          label: '🟢 POZITIV (Risk-On)',
          bg: isBlack ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
          color: '#10B981',
        };
      case 'NEGATIVE':
        return {
          label: '🔴 NEGATIV (Risk-Off)',
          bg: isBlack ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
          color: '#EF4444',
        };
      case 'NEUTRAL':
      default:
        return {
          label: '⚪ NEUTRU (Echilibru)',
          bg: isBlack ? 'rgba(107, 114, 128, 0.2)' : '#F3F4F6',
          color: isBlack ? '#9CA3AF' : '#4B5563',
        };
    }
  };

  if (isLoading && !data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Se preiau cotațiile futures și indicatorii piețelor globale...
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
          onPress={refresh}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>Reîncearcă</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sentiment = data?.globalSentiment;
  const isGlobalPositive = sentiment?.impact === 'POSITIVE';
  const isGlobalNegative = sentiment?.impact === 'NEGATIVE';

  const globalBannerBg = isGlobalPositive
    ? isBlack ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7'
    : isGlobalNegative
    ? isBlack ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2'
    : isBlack ? 'rgba(107, 114, 128, 0.15)' : '#F3F4F6';

  const globalBannerBorder = isGlobalPositive
    ? '#10B981'
    : isGlobalNegative
    ? '#EF4444'
    : '#9CA3AF';

  const usSignals = data?.signals.filter((s) => s.category === 'US_FUTURES') || [];
  const jpSignals = data?.signals.filter((s) => s.category === 'JP_FUTURES' || s.category === 'JP_SPOT') || [];
  const fxSignals = data?.signals.filter((s) => s.category === 'FOREX') || [];

  const renderSignalCard = (signal: GlobalMarketSignal) => {
    const badge = getImpactBadge(signal.impact);
    const sign = signal.changePercent >= 0 ? '+' : '';
    const changeColor = signal.changePercent >= 0 ? '#10B981' : '#EF4444';

    return (
      <View
        key={signal.id}
        style={[
          styles.signalCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderWidth: isBlack ? 1 : 0,
          },
        ]}
      >
        <View style={styles.signalHeader}>
          <View style={styles.signalTitleCol}>
            <Text style={[styles.signalName, { color: colors.text }]}>{signal.name}</Text>
            <Text style={[styles.signalSymbol, { color: colors.textMuted }]}>
              {signal.symbol} • {signal.tradingHoursRO}
            </Text>
          </View>

          <View style={styles.signalPriceCol}>
            <Text style={[styles.signalPrice, { color: colors.text }]}>
              {signal.isAvailable && signal.currentPrice > 0 ? signal.currentPrice.toFixed(2) : 'N/A'}
            </Text>
            {signal.isAvailable && signal.currentPrice > 0 && (
              <Text style={[styles.signalChange, { color: changeColor }]}>
                {sign}{signal.changePercent.toFixed(2)}% ({sign}{signal.change.toFixed(2)})
              </Text>
            )}
          </View>
        </View>

        {/* Impact Badge */}
        <View style={[styles.impactBadgeRow, { backgroundColor: badge.bg }]}>
          <Text style={[styles.impactBadgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>

        {/* Impact Label Description */}
        <Text style={[styles.signalImpactLabel, { color: colors.text }]}>
          {signal.impactLabel}
        </Text>

        {/* Explanatory notes */}
        <View style={[styles.signalNoteBox, { backgroundColor: colors.segmentBackground }]}>
          <Text style={[styles.signalDescription, { color: colors.textMuted }]}>
            ℹ️ {signal.description}
          </Text>
          <Text style={[styles.signalRelevance, { color: colors.text }]}>
            🎯 <Text style={styles.boldText}>Relevanță:</Text> {signal.relevanceNote}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Text style={[styles.title, { color: colors.text }]}>Semnale Piețe Globale</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Futures Americane & Asiatice, Bursa din Tokyo și Cursul USD/JPY (Pre-market)
      </Text>

      {/* Scheduler Alert Note */}
      <View style={[styles.schedulerNotice, { backgroundColor: isBlack ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF', borderColor: '#818CF8' }]}>
        <Text style={[styles.schedulerNoticeText, { color: isBlack ? '#C7D2FE' : '#3730A3' }]}>
          ⏰ <Text style={styles.boldText}>Automatizare zilnică:</Text> Acest sumar se trimite automat pe Discord în canalul <Text style={styles.boldText}>#trading</Text> în fiecare dimineață la <Text style={styles.boldText}>ora 08:00</Text> (ora României).
        </Text>
      </View>

      {/* Global Sentiment Hero Card */}
      {sentiment && (
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: globalBannerBg,
              borderColor: globalBannerBorder,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleGroup}>
              <Text style={styles.heroIcon}>{sentiment.icon}</Text>
              <View>
                <Text style={[styles.heroHeading, { color: colors.text }]}>Sentiment Global</Text>
                <Text style={[styles.heroSubheading, { color: colors.textMuted }]}>
                  {data.evaluationDate} la {data.evaluationTime} (București)
                </Text>
              </View>
            </View>

            <View style={[styles.confidenceBadge, { backgroundColor: colors.card }]}>
              <Text style={[styles.confidenceLabel, { color: colors.textMuted }]}>Încredere</Text>
              <Text style={[styles.confidenceValue, { color: colors.text }]}>
                {sentiment.confidencePercent}%
              </Text>
            </View>
          </View>

          <Text style={[styles.heroLabel, { color: colors.text }]}>{sentiment.label}</Text>

          <View style={styles.heroScoreRow}>
            <Text style={[styles.heroScoreText, { color: colors.textMuted }]}>
              Scor compus: <Text style={[styles.boldText, { color: colors.text }]}>{(sentiment.score >= 0 ? '+' : '') + sentiment.score.toFixed(3)}</Text> [-1.0 ... +1.0]
            </Text>
          </View>

          <Text style={[styles.heroSummary, { color: colors.text }]}>{data.summary}</Text>
        </View>
      )}

      {/* Discord & Check-Only Trigger Buttons */}
      <View style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isBlack ? 1 : 0 }]}>
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.discordButton, isActionBusy && styles.buttonDisabled]}
            onPress={() => sendDiscordReport()}
            disabled={isActionBusy}
            activeOpacity={0.8}
          >
            {isSendingDiscord ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.discordButtonText}>🚀 Trimite Sumar pe Discord (#trading)</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryActionButton,
              {
                backgroundColor: colors.tierBullishBg,
                borderColor: isBlack ? 'rgba(59, 130, 246, 0.45)' : '#93C5FD',
              },
              isActionBusy && styles.buttonDisabled,
            ]}
            onPress={() => checkSignalsOnly()}
            disabled={isActionBusy}
            activeOpacity={0.8}
          >
            {isCheckingOnly ? (
              <ActivityIndicator size="small" color={colors.tierBullishText} />
            ) : (
              <Text style={[styles.secondaryActionButtonText, { color: colors.tierBullishText }]}>
                🔍 Verifică Semnale (fără trimitere)
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {discordStatus && (
          <View style={[styles.statusBanner, { backgroundColor: colors.segmentBackground }]}>
            <Text style={[styles.statusBannerText, { color: colors.text }]}>{discordStatus}</Text>
          </View>
        )}
      </View>

      {/* Legend Card */}
      <View style={[styles.legendCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isBlack ? 1 : 0 }]}>
        <Text style={[styles.legendTitle, { color: colors.text }]}>📖 Ce înseamnă fiecare impact:</Text>
        
        <View style={styles.legendRow}>
          <Text style={styles.legendIcon}>🟢</Text>
          <View style={styles.legendTextCol}>
            <Text style={[styles.legendHeading, { color: '#10B981' }]}>POZITIV (Risk-On)</Text>
            <Text style={[styles.legendDesc, { color: colors.textMuted }]}>
              Optimism în piață. Futures cresc, yenul este stabil/depreciat (carry trade activ). Favorizează intrările de capital în piețele emergente și susține leul (EUR/RON stabil/descendent).
            </Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          <Text style={styles.legendIcon}>⚪</Text>
          <View style={styles.legendTextCol}>
            <Text style={[styles.legendHeading, { color: isBlack ? '#9CA3AF' : '#4B5563' }]}>NEUTRU (Echilibru)</Text>
            <Text style={[styles.legendDesc, { color: colors.textMuted }]}>
              Variații reduse (sub ±0.25%). Piețele sunt în consolidare sau în așteptarea datelor macroeconomice, fără impact direcțional clar.
            </Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          <Text style={styles.legendIcon}>🔴</Text>
          <View style={styles.legendTextCol}>
            <Text style={[styles.legendHeading, { color: '#EF4444' }]}>NEGATIV (Risk-Off)</Text>
            <Text style={[styles.legendDesc, { color: colors.textMuted }]}>
              Aversiune la risc. Futures scad, yenul se apreciază (flight-to-safety). Investitorii vând active de risc, creând presiune pe piețele emergente și valutele locale (EUR/RON tinde să crească).
            </Text>
          </View>
        </View>
      </View>

      {/* Category 1: US Futures */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>🇺🇸 Futures SUA (CME Globex)</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Deschidere luni 01:00 ora României • {data?.usMarketSentiment.description}
        </Text>
      </View>
      {usSignals.map(renderSignalCard)}

      {/* Category 2: Japan Market */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>🇯🇵 Piața Japoneză (Futures & Spot)</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Nikkei CME (01:00) • Osaka (01:45) • Bursa Tokyo (02:00–08:30)
        </Text>
      </View>
      {jpSignals.map(renderSignalCard)}

      {/* Category 3: Forex USD/JPY */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>💱 Forex & Sentiment Valutar</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Duminică ~00:00 → Vineri • Termometrul apetitului de risc
        </Text>
      </View>
      {fxSignals.map(renderSignalCard)}

      {/* Detailed Reasoning */}
      {data?.reasoning && data.reasoning.length > 0 && (
        <View style={[styles.reasoningCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isBlack ? 1 : 0 }]}>
          <Text style={[styles.reasoningTitle, { color: colors.text }]}>🔍 Sinteză & Concluzii Analitice</Text>
          {data.reasoning.map((item, idx) => (
            <Text key={idx} style={[styles.reasoningItem, { color: colors.textMuted }]}>
              • {item}
            </Text>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footerContainer}>
        <Text style={[styles.lastModifiedText, { color: colors.textSubtle }]}>
          Ultima modificare cod: {buildInfo.lastModified}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
    backgroundColor: '#F3F4F6',
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
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 13,
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
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 14,
    lineHeight: 18,
  },
  schedulerNotice: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  schedulerNoticeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    fontSize: 28,
  },
  heroHeading: {
    fontSize: 17,
    fontWeight: '800',
  },
  heroSubheading: {
    fontSize: 11,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  heroLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroScoreRow: {
    marginBottom: 8,
  },
  heroScoreText: {
    fontSize: 12,
  },
  heroSummary: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  actionButtonsContainer: {
    gap: 10,
  },
  discordButton: {
    backgroundColor: '#5865F2', // Culoare Discord
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discordButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionButton: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  statusBannerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  legendCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  legendIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  legendTextCol: {
    flex: 1,
  },
  legendHeading: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  legendDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  signalCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  signalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  signalTitleCol: {
    flex: 1,
    paddingRight: 8,
  },
  signalName: {
    fontSize: 16,
    fontWeight: '700',
  },
  signalSymbol: {
    fontSize: 11,
    marginTop: 2,
  },
  signalPriceCol: {
    alignItems: 'flex-end',
  },
  signalPrice: {
    fontSize: 17,
    fontWeight: '800',
  },
  signalChange: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  impactBadgeRow: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  impactBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  signalImpactLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  signalNoteBox: {
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  signalDescription: {
    fontSize: 11,
    lineHeight: 15,
  },
  signalRelevance: {
    fontSize: 11,
    lineHeight: 15,
  },
  reasoningCard: {
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  reasoningTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  reasoningItem: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6,
  },
  footerContainer: {
    width: '100%',
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 16,
  },
  lastModifiedText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});
