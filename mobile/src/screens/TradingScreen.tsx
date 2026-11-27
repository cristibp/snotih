import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  fetchAlertsStatus,
  fetchAlertSymbols,
  resetAlertSymbols,
  triggerAlertsCheck,
  updateAlertSymbols,
} from '../api/client';
import { AlertCheckResponse, AlertsStatusResponse, RsiSymbolResult, RsiSymbolsConfig, VixAlertResult } from '../api/types';
import buildInfo from '../constants/buildInfo.json';

import { useTheme } from '../theme/ThemeContext';

export const RSI_POLLING_SECONDS = 120;

interface TradingScreenProps {
  isActive?: boolean;
}

export default function TradingScreen({ isActive = true }: TradingScreenProps) {
  const { colors, isBlack } = useTheme();
  const [config, setConfig] = useState<RsiSymbolsConfig | null>(null);
  const [rsiResults, setRsiResults] = useState<RsiSymbolResult[]>([]);
  const [vixResult, setVixResult] = useState<VixAlertResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [checkingMode, setCheckingMode] = useState<'send' | 'checkOnly' | null>(null);
  const isCheckingAny = checkingMode !== null;
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastCheckResponse, setLastCheckResponse] = useState<AlertCheckResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Polling alerte la 120 secunde cand utilizatorul se afla pe pagina
  const [countdown, setCountdown] = useState<number>(RSI_POLLING_SECONDS);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isBackgroundedRef = useRef<boolean>(false);
  const lastFetchedTimestampRef = useRef<number>(Date.now());

  // Stare pentru editarea listei de simboluri
  const [symbolChips, setSymbolChips] = useState<string[]>([]);
  const [newSymbolInput, setNewSymbolInput] = useState<string>('');

  const loadData = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [symbolsData, statusData] = await Promise.all([
        fetchAlertSymbols(),
        fetchAlertsStatus(),
      ]);
      setConfig(symbolsData);
      setSymbolChips(symbolsData.symbols);
      setRsiResults(statusData.results);
      if (statusData.vix) {
        setVixResult(statusData.vix);
      }
      setLastPolledAt(new Date());
      lastFetchedTimestampRef.current = Date.now();
      setCountdown(RSI_POLLING_SECONDS);
    } catch (err: any) {
      console.error('Eroare la incarcarea datelor de alerte:', err);
      setErrorMessage(err?.message || 'Nu s-au putut încărca datele de alerte.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Functie de polling pentru actualizarea periodica a valorilor RSI si VIX
  const pollRsiStatus = useCallback(async () => {
    setIsPolling(true);
    try {
      const statusData = await fetchAlertsStatus();
      setRsiResults(statusData.results);
      if (statusData.vix) {
        setVixResult(statusData.vix);
      }
      setLastPolledAt(new Date());
      lastFetchedTimestampRef.current = Date.now();
    } catch (err: any) {
      console.warn('Eroare la polling alerte status:', err);
    } finally {
      setIsPolling(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling la 120 de secunde cand userul este pe pagina si ecranul este activ
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    if (!isActive) {
      return;
    }

    // Daca userul s-a intors pe tab dupa mai mult de 120s, facem refresh imediat
    const elapsed = Date.now() - lastFetchedTimestampRef.current;
    if (elapsed >= RSI_POLLING_SECONDS * 1000) {
      pollRsiStatus();
      setCountdown(RSI_POLLING_SECONDS);
    }

    countdownTimerRef.current = setInterval(() => {
      if (isBackgroundedRef.current || !isActive) return;
      setCountdown((prev) => {
        if (prev <= 1) {
          return RSI_POLLING_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    timerRef.current = setInterval(() => {
      if (isBackgroundedRef.current || !isActive) return;
      pollRsiStatus();
    }, RSI_POLLING_SECONDS * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isActive, pollRsiStatus]);

  // Gestionare ciclu de viata (Native AppState + Web Visibility API)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState.match(/inactive|background/)) {
        isBackgroundedRef.current = true;
      } else if (nextState === 'active') {
        const wasBackgrounded = isBackgroundedRef.current;
        isBackgroundedRef.current = false;
        if (wasBackgrounded && isActive) {
          const elapsed = Date.now() - lastFetchedTimestampRef.current;
          if (elapsed >= RSI_POLLING_SECONDS * 1000) {
            setCountdown(RSI_POLLING_SECONDS);
            pollRsiStatus();
          }
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        if (document.hidden) {
          isBackgroundedRef.current = true;
        } else {
          isBackgroundedRef.current = false;
          if (isActive) {
            const elapsed = Date.now() - lastFetchedTimestampRef.current;
            if (elapsed >= RSI_POLLING_SECONDS * 1000) {
              setCountdown(RSI_POLLING_SECONDS);
              pollRsiStatus();
            }
          }
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      sub.remove();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [isActive, pollRsiStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const handleAddSymbol = () => {
    const clean = newSymbolInput.trim().toUpperCase();
    if (!clean) return;

    if (symbolChips.includes(clean)) {
      Alert.alert('Simbol existent', `Simbolul ${clean} este deja în listă.`);
      return;
    }

    setSymbolChips([...symbolChips, clean]);
    setNewSymbolInput('');
  };

  const handleRemoveSymbol = (sym: string) => {
    if (symbolChips.length <= 1) {
      Alert.alert('Atenție', 'Trebuie să păstrezi cel puțin un simbol în listă.');
      return;
    }
    setSymbolChips(symbolChips.filter((s) => s !== sym));
  };

  const handleSaveSymbols = async () => {
    if (symbolChips.length === 0) {
      Alert.alert('Eroare', 'Lista de simboluri nu poate fi goală.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updatedConfig = await updateAlertSymbols(symbolChips);
      setConfig(updatedConfig);
      setSymbolChips(updatedConfig.symbols);

      // Reincarcam valorile dupa actualizarea listei
      const statusData = await fetchAlertsStatus();
      setRsiResults(statusData.results);
      if (statusData.vix) setVixResult(statusData.vix);

      Alert.alert('Succes', 'Lista de simboluri a fost salvată pe server.');
    } catch (err: any) {
      console.error('Eroare la salvarea simbolurilor:', err);
      setErrorMessage(err?.message || 'Salvarea simbolurilor a eșuat.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToEnv = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const resetConfig = await resetAlertSymbols();
      setConfig(resetConfig);
      setSymbolChips(resetConfig.symbols);

      const statusData = await fetchAlertsStatus();
      setRsiResults(statusData.results);
      if (statusData.vix) setVixResult(statusData.vix);

      Alert.alert('Resetat', 'Lista a fost resetată la valorile implicite din variabilele de mediu.');
    } catch (err: any) {
      console.error('Eroare la resetarea simbolurilor:', err);
      setErrorMessage(err?.message || 'Resetarea simbolurilor a eșuat.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunRsiCheck = async () => {
    setCheckingMode('send');
    setErrorMessage(null);
    try {
      const checkRes = await triggerAlertsCheck();
      setLastCheckResponse(checkRes);
      setRsiResults(checkRes.results);
      if (checkRes.vix) setVixResult(checkRes.vix);
      setLastPolledAt(new Date());
      lastFetchedTimestampRef.current = Date.now();
      setCountdown(RSI_POLLING_SECONDS);
    } catch (err: any) {
      console.error('Eroare la verificarea alertelor:', err);
      setErrorMessage(err?.message || 'Verificarea alertelor a eșuat.');
    } finally {
      setCheckingMode(null);
    }
  };

  const handleCheckAlertsOnly = async () => {
    setCheckingMode('checkOnly');
    setErrorMessage(null);
    try {
      const statusData = await fetchAlertsStatus();
      const triggeredRsi = statusData.results.filter((r) => r.triggered);
      const vixTriggered = Boolean(statusData.vix && statusData.vix.thresholdSurpassed);
      const totalTriggered = triggeredRsi.length + (vixTriggered ? 1 : 0);

      setConfig(statusData.config);
      setRsiResults(statusData.results);
      if (statusData.vix) {
        setVixResult(statusData.vix);
      }
      setLastPolledAt(new Date());
      lastFetchedTimestampRef.current = Date.now();
      setCountdown(RSI_POLLING_SECONDS);

      setLastCheckResponse({
        timestamp: statusData.timestamp,
        totalChecked: statusData.results.length + (statusData.vix ? 1 : 0),
        totalTriggered,
        results: statusData.results,
        vix: statusData.vix,
        discordNotified: false,
        discordChannel: '#trading',
        discordDetails:
          totalTriggered > 0
            ? `Verificare fără trimitere pe canal: ${totalTriggered} alerte detectate (${triggeredRsi.length} RSI, ${vixTriggered ? '1 VIX' : '0 VIX'}).`
            : 'Verificare fără trimitere pe canal: nicio alertă declanșată.',
      });
    } catch (err: any) {
      console.error('Eroare la verificarea alertelor (fără trimitere):', err);
      setErrorMessage(err?.message || 'Verificarea alertelor a eșuat.');
    } finally {
      setCheckingMode(null);
    }
  };

  const getTierColor = (rsi: number) => {
    if (rsi <= 30) return colors.danger;
    if (rsi <= 35) return colors.tierBearishText;
    if (rsi <= 40) return colors.accentBlue;
    return colors.success;
  };

  const getTierBadge = (rsi: number) => {
    if (rsi <= 30) return { label: '🔴 RSI ≤ 30 (Critic)', color: colors.tierOverboughtText, bg: colors.tierOverboughtBg };
    if (rsi <= 35) return { label: '🟠 RSI ≤ 35 (Pronunțat)', color: colors.tierBearishText, bg: colors.tierBearishBg };
    if (rsi <= 40) return { label: '🔵 RSI ≤ 40 (Monitorizare)', color: colors.tierBullishText, bg: colors.tierBullishBg };
    return { label: '🟢 RSI > 40 (Normal)', color: colors.tierOversoldText, bg: colors.tierOversoldBg };
  };

  // Nivel VIX procentual pentru bara vizuala (0-50 puncte)
  const vixPercent = vixResult ? Math.min(100, Math.max(0, (vixResult.currentPrice / 50) * 100)) : 0;
  const vixBarColor = vixResult
    ? vixResult.thresholdSurpassed || vixResult.currentPrice > 35
      ? colors.danger
      : vixResult.currentPrice > 20
        ? colors.tierBearishText
        : colors.success
    : colors.textMuted;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentBlue} />}
    >
      <Text style={[styles.title, { color: colors.text }]}>Monitorizare Alerte</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Alerte automate pe canalul <Text style={[styles.boldText, { color: colors.text }]}>#trading</Text> la atingerea pragurilor RSI sau volatilitate extremă VIX
      </Text>

      {/* Legenda Praguri Alerta */}
      <View
        style={[
          styles.legendCard,
          {
            backgroundColor: colors.legendCardBg,
            borderColor: colors.cardBorder,
            borderWidth: isBlack ? 1 : 0,
          },
        ]}
      >
        <Text style={[styles.legendTitle, { color: colors.textMuted }]}>Niveluri Praguri & Culori Notificare:</Text>
        <View style={styles.legendPillsContainer}>
          <View style={[styles.legendPill, { backgroundColor: colors.tierBullishBg }]}>
            <Text style={[styles.legendPillText, { color: colors.tierBullishText }]}>🔵 RSI ≤ 40 (Albastru)</Text>
          </View>
          <View style={[styles.legendPill, { backgroundColor: colors.tierBearishBg }]}>
            <Text style={[styles.legendPillText, { color: colors.tierBearishText }]}>🟠 RSI ≤ 35 (Portocaliu)</Text>
          </View>
          <View style={[styles.legendPill, { backgroundColor: colors.tierOverboughtBg }]}>
            <Text style={[styles.legendPillText, { color: colors.tierOverboughtText }]}>🔴 RSI ≤ 30 (Roșu)</Text>
          </View>
          <View style={[styles.legendPill, { backgroundColor: isBlack ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
            <Text style={[styles.legendPillText, { color: isBlack ? '#FCA5A5' : '#B91C1C' }]}>⚡ VIX: Creștere ≥ 20% sau &gt; 35</Text>
          </View>
        </View>
      </View>

      {/* Butoane Verificare Manuala & Discord Trigger */}
      <View
        style={[
          styles.actionCard,
          {
            backgroundColor: colors.actionCardBg,
            borderColor: colors.cardBorder,
            borderWidth: isBlack ? 1 : 0,
          },
        ]}
      >
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, isCheckingAny && styles.buttonDisabled]}
            onPress={handleRunRsiCheck}
            disabled={isCheckingAny}
            activeOpacity={0.8}
          >
            {checkingMode === 'send' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>🚀 Verifică Alerte & Trimite (#trading)</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryActionButton,
              {
                backgroundColor: colors.tierBullishBg,
                borderColor: isBlack ? 'rgba(59, 130, 246, 0.45)' : '#93C5FD',
              },
              isCheckingAny && styles.buttonDisabled,
            ]}
            onPress={handleCheckAlertsOnly}
            disabled={isCheckingAny}
            activeOpacity={0.8}
          >
            {checkingMode === 'checkOnly' ? (
              <ActivityIndicator size="small" color={colors.tierBullishText} />
            ) : (
              <Text style={[styles.secondaryActionButtonText, { color: colors.tierBullishText }]}>
                🔍 Verifică Alerte (fără trimitere)
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {lastCheckResponse && (
          <View
            style={[
              styles.responseBanner,
              {
                backgroundColor: colors.responseBannerBg,
                borderLeftColor: colors.responseBannerBorder,
              },
            ]}
          >
            <Text style={[styles.responseTitle, { color: colors.responseTitle }]}>Rezultat Verificare:</Text>
            <Text style={[styles.responseText, { color: colors.responseText }]}>
              • Total verificate: <Text style={[styles.boldText, { color: colors.text }]}>{lastCheckResponse.totalChecked}</Text> (RSI + VIX)
            </Text>
            <Text style={[styles.responseText, { color: colors.responseText }]}>
              • Alerte declanșate: <Text style={[styles.boldText, { color: colors.text }]}>{lastCheckResponse.totalTriggered}</Text>
              {lastCheckResponse.vix?.thresholdSurpassed ? ' (inclusiv VIX)' : ''}
            </Text>
            <Text style={[styles.responseText, { color: colors.responseText }]}>
              • Discord (#trading):{' '}
              <Text style={{ color: lastCheckResponse.discordNotified ? colors.success : colors.textMuted, fontWeight: '600' }}>
                {lastCheckResponse.discordDetails || (lastCheckResponse.discordNotified ? 'Trimis cu succes' : 'Nicio notificare')}
              </Text>
            </Text>
          </View>
        )}
      </View>

      {errorMessage && (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: colors.errorBoxBg,
              borderColor: colors.errorBoxBorder,
            },
          ]}
        >
          <Text style={[styles.errorText, { color: colors.errorBoxText }]}>{errorMessage}</Text>
        </View>
      )}

      {/* ─── Card Volatilitate VIX ─── */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Volatilitate Piață (VIX)</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Alertă la creștere ≥ +20% sau nivel &gt; 35 orar
          </Text>
        </View>
      </View>

      {vixResult && (
        <View
          style={[
            styles.vixCard,
            {
              backgroundColor: colors.card,
              borderColor: vixResult.thresholdSurpassed ? colors.danger : colors.cardBorder,
              borderWidth: vixResult.thresholdSurpassed ? 2 : (isBlack ? 1 : 0),
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View>
              <View style={styles.vixTitleRow}>
                <Text style={[styles.symbolCode, { color: colors.text }]}>{vixResult.symbol}</Text>
                {vixResult.thresholdSurpassed && (
                  <View style={[styles.vixAlertPill, { backgroundColor: isBlack ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2' }]}>
                    <Text style={[styles.vixAlertPillText, { color: isBlack ? '#FCA5A5' : '#B91C1C' }]}>
                      🚨 ALERTĂ ACTIVĂ
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.symbolName, { color: colors.textMuted }]} numberOfLines={1}>
                {vixResult.name}
              </Text>
            </View>

            <View style={styles.priceContainer}>
              <Text style={[styles.priceText, { color: colors.text }]}>
                {vixResult.currentPrice > 0 ? vixResult.currentPrice.toFixed(2) : 'N/A'}
              </Text>
              <View
                style={[
                  styles.tierBadge,
                  {
                    backgroundColor: vixResult.thresholdSurpassed
                      ? colors.tierOverboughtBg
                      : colors.tierOversoldBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tierBadgeText,
                    {
                      color: vixResult.thresholdSurpassed
                        ? colors.tierOverboughtText
                        : colors.tierOversoldText,
                    },
                  ]}
                >
                  {vixResult.thresholdSurpassed ? '🔴 Critic (>35 sau +20%)' : '🟢 Normal (≤35)'}
                </Text>
              </View>
            </View>
          </View>

          {/* Metric Chips Row */}
          <View style={styles.vixMetricsRow}>
            <View style={[styles.vixMetricChip, { backgroundColor: colors.chipBackground, borderColor: colors.chipBorder }]}>
              <Text style={[styles.vixMetricLabel, { color: colors.textMuted }]}>Variație Zi</Text>
              <Text
                style={[
                  styles.vixMetricValue,
                  { color: vixResult.changePercent >= 20 ? colors.danger : (vixResult.changePercent >= 0 ? colors.tierBearishText : colors.success) },
                ]}
              >
                {vixResult.changePercent >= 0 ? '+' : ''}{vixResult.changePercent.toFixed(2)}%
              </Text>
            </View>

            <View style={[styles.vixMetricChip, { backgroundColor: colors.chipBackground, borderColor: colors.chipBorder }]}>
              <Text style={[styles.vixMetricLabel, { color: colors.textMuted }]}>Variație 1h</Text>
              <Text
                style={[
                  styles.vixMetricValue,
                  {
                    color:
                      vixResult.hourlyChangePercent !== undefined && vixResult.hourlyChangePercent >= 20
                        ? colors.danger
                        : (vixResult.hourlyChangePercent !== undefined && vixResult.hourlyChangePercent > 0
                          ? colors.tierBearishText
                          : colors.text),
                  },
                ]}
              >
                {vixResult.hourlyChangePercent !== undefined
                  ? `${vixResult.hourlyChangePercent >= 0 ? '+' : ''}${vixResult.hourlyChangePercent.toFixed(2)}%`
                  : 'N/A'}
              </Text>
            </View>

            <View style={[styles.vixMetricChip, { backgroundColor: colors.chipBackground, borderColor: colors.chipBorder }]}>
              <Text style={[styles.vixMetricLabel, { color: colors.textMuted }]}>Închidere Prec.</Text>
              <Text style={[styles.vixMetricValue, { color: colors.text }]}>
                {vixResult.previousClose > 0 ? vixResult.previousClose.toFixed(2) : 'N/A'}
              </Text>
            </View>
          </View>

          {/* Bara vizuala VIX */}
          <View style={styles.rsiBarContainer}>
            <View style={styles.rsiBarLabels}>
              <Text style={[styles.rsiLabelText, { color: colors.textMuted }]}>Nivel VIX (0-50+):</Text>
              <Text style={[styles.rsiValueText, { color: vixBarColor }]}>
                {vixResult.currentPrice > 0 ? vixResult.currentPrice.toFixed(2) : 'N/A'}
              </Text>
            </View>
            <View style={[styles.progressBarBackground, { backgroundColor: colors.progressBarBg }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${vixPercent}%`,
                    backgroundColor: vixBarColor,
                  },
                ]}
              />
            </View>
          </View>

          {vixResult.thresholdSurpassed && vixResult.reasons.length > 0 ? (
            <View style={[styles.vixWarningBox, { backgroundColor: isBlack ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2' }]}>
              {vixResult.reasons.map((r, idx) => (
                <Text key={idx} style={[styles.vixWarningText, { color: isBlack ? '#FCA5A5' : '#B91C1C' }]}>
                  ⚠️ {r}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={[styles.cardMessage, { color: colors.textMuted }]}>{vixResult.message}</Text>
          )}
        </View>
      )}

      {/* Lista Simboluri RSI Monitorizate Live */}
      <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Simboluri ETF & RSI Curent</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Polling activ la 120s când ești pe pagină
          </Text>
        </View>

        <View style={styles.headerRightContainer}>
          {isLoading || isPolling ? (
            <View style={styles.pollingStatusRow}>
              <ActivityIndicator size="small" color={colors.accentBlue} />
              <Text style={[styles.pollingStatusText, { color: colors.accentBlue }]}>Actualizare...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.pollingBadge,
                {
                  backgroundColor: isBlack ? '#1E293B' : '#E0E7FF',
                  borderColor: isBlack ? '#334155' : '#C7D2FE',
                },
              ]}
              onPress={pollRsiStatus}
              activeOpacity={0.7}
            >
              <View style={styles.liveDot} />
              <Text style={[styles.pollingBadgeText, { color: isBlack ? '#818CF8' : '#3730A3' }]}>
                120s ({countdown}s)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {rsiResults.map((item) => {
        const badge = getTierBadge(item.rsi);
        const barColor = getTierColor(item.rsi);
        const barPercent = Math.min(100, Math.max(0, item.rsi));

        return (
          <View
            key={item.symbol}
            style={[
              styles.symbolCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderWidth: isBlack ? 1 : 0,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.symbolCode, { color: colors.text }]}>{item.symbol}</Text>
                <Text style={[styles.symbolName, { color: colors.textMuted }]} numberOfLines={1}>
                  {item.name || item.resolvedSymbol}
                </Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={[styles.priceText, { color: colors.text }]}>
                  {item.currentPrice > 0 ? `${item.currentPrice.toFixed(2)} ${item.currency || 'EUR'}` : 'N/A'}
                </Text>
                <View style={[styles.tierBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.tierBadgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>
            </View>

            {/* Bara vizuala RSI */}
            <View style={styles.rsiBarContainer}>
              <View style={styles.rsiBarLabels}>
                <Text style={[styles.rsiLabelText, { color: colors.textMuted }]}>RSI (14):</Text>
                <Text style={[styles.rsiValueText, { color: barColor }]}>
                  {item.rsi > 0 ? item.rsi.toFixed(2) : 'N/A'}
                </Text>
              </View>
              <View style={[styles.progressBarBackground, { backgroundColor: colors.progressBarBg }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${barPercent}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
            </View>

            <Text style={[styles.cardMessage, { color: colors.textMuted }]}>{item.message}</Text>
          </View>
        );
      })}

      {/* Sectiunea Configurare / Suprascriere Simboluri */}
      <View
        style={[
          styles.configCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            borderWidth: isBlack ? 1 : 0,
          },
        ]}
      >
        <View style={styles.configHeaderRow}>
          <Text style={[styles.configTitle, { color: colors.text }]}>⚙️ Configurare Watchlist RSI</Text>
          <View
            style={[
              styles.statusChip,
              {
                backgroundColor: config?.isOverridden
                  ? isBlack ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7'
                  : isBlack ? 'rgba(99, 102, 241, 0.2)' : '#E0E7FF',
              },
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                {
                  color: config?.isOverridden
                    ? isBlack ? '#FBBF24' : '#B45309'
                    : isBlack ? '#A5B4FC' : '#3730A3',
                },
              ]}
            >
              {config?.isOverridden ? 'Suprascris din Frontend' : 'Implicit din .env'}
            </Text>
          </View>
        </View>

        <Text style={[styles.configSubtitle, { color: colors.textMuted }]}>
          Poți adăuga sau șterge ETF-uri/acțiuni (ex: WEBN, IWDA, CSPX.L, VWCE.DE). Modificările suprascriu variabilele de mediu.
        </Text>

        {/* Chips lista curenta */}
        <View style={styles.chipsContainer}>
          {symbolChips.map((sym) => (
            <View
              key={sym}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.chipBackground,
                  borderColor: colors.chipBorder,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.chipText }]}>{sym}</Text>
              <TouchableOpacity
                onPress={() => handleRemoveSymbol(sym)}
                style={[styles.chipRemoveBtn, { backgroundColor: colors.chipRemoveBtn }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.chipRemoveText, { color: colors.chipRemoveText }]}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Input adaugare simbol nou */}
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
            placeholder="Adaugă simbol (ex: WEBN, IWDA, VWCE.DE)"
            placeholderTextColor={colors.inputPlaceholder}
            value={newSymbolInput}
            onChangeText={setNewSymbolInput}
            autoCapitalize="characters"
            onSubmitEditing={handleAddSymbol}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddSymbol} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>+ Adaugă</Text>
          </TouchableOpacity>
        </View>

        {/* Butoane Salvare / Resetare */}
        <View style={styles.configButtonsRow}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={handleSaveSymbols}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>💾 Salvează Modificările</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resetButton,
              {
                backgroundColor: colors.chipBackground,
                borderColor: colors.chipBorder,
              },
              isSaving && styles.buttonDisabled,
            ]}
            onPress={handleResetToEnv}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Text style={[styles.resetButtonText, { color: colors.textMuted }]}>🔄 Reset la ENV Defaults</Text>
          </TouchableOpacity>
        </View>
      </View>

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
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#1F2937',
  },
  legendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legendPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  legendPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  legendPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtonsContainer: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActionButton: {
    paddingVertical: 13,
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
  responseBanner: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  responseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pollingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pollingStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pollingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  pollingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  vixCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  vixTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vixAlertPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vixAlertPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  vixMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  vixMetricChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  vixMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  vixMetricValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  vixWarningBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  vixWarningText: {
    fontSize: 12,
    fontWeight: '700',
  },
  symbolCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  symbolCode: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  symbolName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    maxWidth: 160,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rsiBarContainer: {
    marginTop: 6,
    marginBottom: 8,
  },
  rsiBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rsiLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  rsiValueText: {
    fontSize: 15,
    fontWeight: '800',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  cardMessage: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  configCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  configHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  configTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  configSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 14,
    lineHeight: 18,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 6,
  },
  chipRemoveBtn: {
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRemoveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  configButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  resetButtonText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  footerContainer: {
    width: '100%',
    alignItems: 'flex-end',
    marginTop: 16,
  },
  lastModifiedText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});


