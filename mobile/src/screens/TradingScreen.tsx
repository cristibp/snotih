import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  fetchRsiStatus,
  fetchRsiSymbols,
  resetRsiSymbols,
  triggerRsiCheck,
  updateRsiSymbols,
} from '../api/client';
import { RsiCheckResponse, RsiSymbolResult, RsiSymbolsConfig } from '../api/types';
import buildInfo from '../constants/buildInfo.json';

export default function TradingScreen() {
  const [config, setConfig] = useState<RsiSymbolsConfig | null>(null);
  const [rsiResults, setRsiResults] = useState<RsiSymbolResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastCheckResponse, setLastCheckResponse] = useState<RsiCheckResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stare pentru editarea listei de simboluri
  const [symbolChips, setSymbolChips] = useState<string[]>([]);
  const [newSymbolInput, setNewSymbolInput] = useState<string>('');

  const loadData = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [symbolsData, statusData] = await Promise.all([
        fetchRsiSymbols(),
        fetchRsiStatus(),
      ]);
      setConfig(symbolsData);
      setSymbolChips(symbolsData.symbols);
      setRsiResults(statusData.results);
    } catch (err: any) {
      console.error('Eroare la incarcarea datelor RSI:', err);
      setErrorMessage(err?.message || 'Nu s-au putut încărca datele RSI.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      const updatedConfig = await updateRsiSymbols(symbolChips);
      setConfig(updatedConfig);
      setSymbolChips(updatedConfig.symbols);

      // Reincarcam valorile RSI dupa actualizarea listei
      const statusData = await fetchRsiStatus();
      setRsiResults(statusData.results);

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
      const resetConfig = await resetRsiSymbols();
      setConfig(resetConfig);
      setSymbolChips(resetConfig.symbols);

      const statusData = await fetchRsiStatus();
      setRsiResults(statusData.results);

      Alert.alert('Resetat', 'Lista a fost resetată la valorile implicite din variabilele de mediu.');
    } catch (err: any) {
      console.error('Eroare la resetarea simbolurilor:', err);
      setErrorMessage(err?.message || 'Resetarea simbolurilor a eșuat.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunRsiCheck = async () => {
    setIsChecking(true);
    setErrorMessage(null);
    try {
      const checkRes = await triggerRsiCheck();
      setLastCheckResponse(checkRes);
      setRsiResults(checkRes.results);
    } catch (err: any) {
      console.error('Eroare la verificarea RSI:', err);
      setErrorMessage(err?.message || 'Verificarea RSI a eșuat.');
    } finally {
      setIsChecking(false);
    }
  };

  const getTierColor = (rsi: number) => {
    if (rsi <= 30) return '#EF4444'; // Red
    if (rsi <= 35) return '#F97316'; // Orange
    if (rsi <= 40) return '#3B82F6'; // Blue
    return '#10B981'; // Green (Neutral)
  };

  const getTierBadge = (rsi: number) => {
    if (rsi <= 30) return { label: '🔴 RSI ≤ 30 (Critic)', color: '#EF4444', bg: '#FEE2E2' };
    if (rsi <= 35) return { label: '🟠 RSI ≤ 35 (Pronunțat)', color: '#C2410C', bg: '#FFEDD5' };
    if (rsi <= 40) return { label: '🔵 RSI ≤ 40 (Monitorizare)', color: '#1D4ED8', bg: '#DBEAFE' };
    return { label: '🟢 RSI > 40 (Normal)', color: '#047857', bg: '#D1FAE5' };
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Monitorizare RSI</Text>
      <Text style={styles.subtitle}>
        Alerte automate pe canalul <Text style={styles.boldText}>#trading</Text> la atingerea pragurilor RSI
      </Text>

      {/* Legenda Praguri Alerta */}
      <View style={styles.legendCard}>
        <Text style={styles.legendTitle}>Niveluri Praguri & Culori Notificare:</Text>
        <View style={styles.legendPillsContainer}>
          <View style={[styles.legendPill, { backgroundColor: '#DBEAFE' }]}>
            <Text style={[styles.legendPillText, { color: '#1D4ED8' }]}>🔵 RSI ≤ 40 (Albastru)</Text>
          </View>
          <View style={[styles.legendPill, { backgroundColor: '#FFEDD5' }]}>
            <Text style={[styles.legendPillText, { color: '#C2410C' }]}>🟠 RSI ≤ 35 (Portocaliu)</Text>
          </View>
          <View style={[styles.legendPill, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.legendPillText, { color: '#B91C1C' }]}>🔴 RSI ≤ 30 (Roșu)</Text>
          </View>
        </View>
      </View>

      {/* Buton Verificare Manuala & Discord Trigger */}
      <View style={styles.actionCard}>
        <TouchableOpacity
          style={[styles.primaryButton, isChecking && styles.buttonDisabled]}
          onPress={handleRunRsiCheck}
          disabled={isChecking}
          activeOpacity={0.8}
        >
          {isChecking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>🚀 Verifică RSI & Trimite Alerte (#trading)</Text>
          )}
        </TouchableOpacity>

        {lastCheckResponse && (
          <View style={styles.responseBanner}>
            <Text style={styles.responseTitle}>Rezultat Verificare:</Text>
            <Text style={styles.responseText}>
              • Total verificate: <Text style={styles.boldText}>{lastCheckResponse.totalChecked}</Text>
            </Text>
            <Text style={styles.responseText}>
              • Alerte declanșate: <Text style={styles.boldText}>{lastCheckResponse.totalTriggered}</Text>
            </Text>
            <Text style={styles.responseText}>
              • Discord (#trading):{' '}
              <Text style={{ color: lastCheckResponse.discordNotified ? '#10B981' : '#6B7280', fontWeight: '600' }}>
                {lastCheckResponse.discordDetails || (lastCheckResponse.discordNotified ? 'Trimis cu succes' : 'Nicio notificare')}
              </Text>
            </Text>
          </View>
        )}
      </View>

      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Lista Simboluri Monitorizate Live */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Simboluri Active & RSI Curent</Text>
        {isLoading && <ActivityIndicator size="small" color="#2563EB" />}
      </View>

      {rsiResults.map((item) => {
        const badge = getTierBadge(item.rsi);
        const barColor = getTierColor(item.rsi);
        const barPercent = Math.min(100, Math.max(0, item.rsi));

        return (
          <View key={item.symbol} style={styles.symbolCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.symbolCode}>{item.symbol}</Text>
                <Text style={styles.symbolName} numberOfLines={1}>
                  {item.name || item.resolvedSymbol}
                </Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.priceText}>
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
                <Text style={styles.rsiLabelText}>RSI (14):</Text>
                <Text style={[styles.rsiValueText, { color: barColor }]}>
                  {item.rsi > 0 ? item.rsi.toFixed(2) : 'N/A'}
                </Text>
              </View>
              <View style={styles.progressBarBackground}>
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

            <Text style={styles.cardMessage}>{item.message}</Text>
          </View>
        );
      })}

      {/* Sectiunea Configurare / Suprascriere Simboluri */}
      <View style={styles.configCard}>
        <View style={styles.configHeaderRow}>
          <Text style={styles.configTitle}>⚙️ Configurare Watchlist</Text>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: config?.isOverridden ? '#FEF3C7' : '#E0E7FF' },
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                { color: config?.isOverridden ? '#B45309' : '#3730A3' },
              ]}
            >
              {config?.isOverridden ? 'Suprascris din Frontend' : 'Implicit din .env'}
            </Text>
          </View>
        </View>

        <Text style={styles.configSubtitle}>
          Poți adăuga sau șterge ETF-uri/acțiuni (ex: WEBN, IWDA, CSPX.L, VWCE.DE). Modificările suprascriu variabilele de mediu.
        </Text>

        {/* Chips lista curenta */}
        <View style={styles.chipsContainer}>
          {symbolChips.map((sym) => (
            <View key={sym} style={styles.chip}>
              <Text style={styles.chipText}>{sym}</Text>
              <TouchableOpacity
                onPress={() => handleRemoveSymbol(sym)}
                style={styles.chipRemoveBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.chipRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Input adaugare simbol nou */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Adaugă simbol (ex: WEBN, IWDA, VWCE.DE)"
            placeholderTextColor="#9CA3AF"
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
            style={[styles.resetButton, isSaving && styles.buttonDisabled]}
            onPress={handleResetToEnv}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Text style={styles.resetButtonText}>🔄 Reset la ENV Defaults</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footerContainer}>
        <Text style={styles.lastModifiedText}>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
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
