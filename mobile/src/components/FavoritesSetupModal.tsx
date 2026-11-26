import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { searchWatchlistSymbols } from '../api/client';
import { FavoriteList, MarketQuote, WatchlistSymbolMeta } from '../api/types';
import { useTheme } from '../theme/ThemeContext';

interface FavoritesSetupModalProps {
  visible: boolean;
  currentFavorites: string[];
  quotes?: Record<string, MarketQuote>;
  initialSearchQuery?: string;
  onSaveFavorites: (newFavorites: string[]) => Promise<void> | void;
  onClose: () => void;
  allLists?: FavoriteList[];
  activeListId?: string;
  onSwitchList?: (listId: string) => void;
}

interface ExistingSymbolEntry {
  symbol: string;
  name?: string;
  category?: string;
  exchange?: string;
  lists: FavoriteList[];
}

export default function FavoritesSetupModal({
  visible,
  currentFavorites,
  quotes,
  initialSearchQuery = '',
  onSaveFavorites,
  onClose,
  allLists,
  activeListId,
  onSwitchList,
}: FavoritesSetupModalProps) {
  const { colors, isBlack } = useTheme();
  const [selectedFavs, setSelectedFavs] = useState<string[]>(currentFavorites);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [remoteResults, setRemoteResults] = useState<WatchlistSymbolMeta[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState<boolean>(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [discoveredMeta, setDiscoveredMeta] = useState<Record<string, WatchlistSymbolMeta>>({});
  const [isSavingLocal, setIsSavingLocal] = useState<boolean>(false);

  const activeList = useMemo(
    () => allLists?.find((l) => l.id === activeListId) || null,
    [allLists, activeListId]
  );

  // Sincronizare la deschidere sau schimbare de lista activa
  useEffect(() => {
    if (visible) {
      setSelectedFavs(currentFavorites);
      setSearchQuery(initialSearchQuery || '');
      setRemoteResults([]);
      setRemoteError(null);
    }
  }, [visible, currentFavorites, initialSearchQuery]);

  // Cautare online debounced pentru acțiuni / ETF-uri noi
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!visible || trimmed.length < 1) {
      setRemoteResults([]);
      setIsSearchingRemote(false);
      setRemoteError(null);
      return;
    }

    let cancelled = false;
    setIsSearchingRemote(true);
    setRemoteError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await searchWatchlistSymbols(trimmed);
        if (!cancelled) {
          setRemoteResults(results);
        }
      } catch (err: any) {
        if (!cancelled) {
          setRemoteResults([]);
          setRemoteError(err?.message || 'Căutarea online nu a putut fi finalizată.');
        }
      } finally {
        if (!cancelled) {
          setIsSearchingRemote(false);
        }
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, visible]);

  // Construim catalogul de simboluri existente exclusiv din watchlist-urile GitHub + selectia curenta
  const existingWatchlistEntries = useMemo<ExistingSymbolEntry[]>(() => {
    const entryMap = new Map<string, ExistingSymbolEntry>();

    const ensureEntry = (rawSym: string): ExistingSymbolEntry | null => {
      const sym = rawSym.trim().toUpperCase();
      if (!sym) return null;
      let existing = entryMap.get(sym);
      if (!existing) {
        const meta = discoveredMeta[sym];
        const quote = quotes?.[sym];
        existing = {
          symbol: sym,
          name: quote?.name || meta?.name,
          category: meta?.category,
          exchange: meta?.exchange,
          lists: [],
        };
        entryMap.set(sym, existing);
      }
      return existing;
    };

    (allLists || []).forEach((list) => {
      (list.symbols || []).forEach((sym) => {
        const entry = ensureEntry(sym);
        if (entry && !entry.lists.some((l) => l.id === list.id)) {
          entry.lists.push(list);
        }
      });
    });

    currentFavorites.forEach((sym) => {
      ensureEntry(sym);
    });

    selectedFavs.forEach((sym) => {
      ensureEntry(sym);
    });

    return Array.from(entryMap.values());
  }, [allLists, currentFavorites, selectedFavs, quotes, discoveredMeta]);

  const filteredExisting = useMemo(() => {
    const trimmed = searchQuery.trim().toUpperCase();
    if (!trimmed) {
      return existingWatchlistEntries;
    }
    return existingWatchlistEntries.filter(
      (item) =>
        item.symbol.toUpperCase().includes(trimmed) ||
        (item.name && item.name.toUpperCase().includes(trimmed)) ||
        (item.category && item.category.toUpperCase().includes(trimmed)) ||
        item.lists.some((l) => l.name.toUpperCase().includes(trimmed))
    );
  }, [existingWatchlistEntries, searchQuery]);

  const existingSymbolSet = useMemo(
    () => new Set(existingWatchlistEntries.map((e) => e.symbol)),
    [existingWatchlistEntries]
  );

  // Filtrare rezultate online care nu sunt deja afisate in sectiunea de watchlist-uri existente
  const filteredRemoteNew = useMemo(() => {
    return remoteResults.filter((item) => !existingSymbolSet.has(item.symbol.toUpperCase()));
  }, [remoteResults, existingSymbolSet]);

  const directTickerCandidate = useMemo(() => {
    const cleaned = searchQuery.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleaned || !/^[A-Z0-9^.=_-]{1,20}$/.test(cleaned)) {
      return '';
    }
    if (selectedFavs.includes(cleaned)) {
      return '';
    }
    if (remoteResults.some((r) => r.symbol.toUpperCase() === cleaned)) {
      return '';
    }
    return cleaned;
  }, [searchQuery, selectedFavs, remoteResults]);

  const handleToggle = (symbol: string, meta?: WatchlistSymbolMeta) => {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;
    if (meta) {
      setDiscoveredMeta((prev) => ({ ...prev, [cleanSym]: meta }));
    }
    const isSelected = selectedFavs.includes(cleanSym);
    if (isSelected) {
      setSelectedFavs(selectedFavs.filter((s) => s !== cleanSym));
    } else {
      setSelectedFavs([...selectedFavs, cleanSym]);
    }
  };

  const handleAddDirectTicker = () => {
    if (!directTickerCandidate) return;
    if (!selectedFavs.includes(directTickerCandidate)) {
      setSelectedFavs([...selectedFavs, directTickerCandidate]);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...selectedFavs];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setSelectedFavs(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedFavs.length - 1) return;
    const next = [...selectedFavs];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setSelectedFavs(next);
  };

  const handleResetSelection = () => {
    setSelectedFavs(currentFavorites);
  };

  const handleSave = async () => {
    setIsSavingLocal(true);
    try {
      await onSaveFavorites(selectedFavs);
      onClose();
    } finally {
      setIsSavingLocal(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isBlack ? '#0F172A' : '#FFFFFF',
              borderColor: colors.cardBorder,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Watchlist GitHub & Acțiuni Noi
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                {activeList
                  ? `Listă: ${activeList.icon || '⭐'} ${activeList.name} • ${selectedFavs.length} ${selectedFavs.length === 1 ? 'simbol selectat' : 'simboluri selectate'}`
                  : `Selectează sau adaugă simboluri (${selectedFavs.length} selectate)`}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.closeIconBtn, { borderColor: colors.cardBorder }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.closeIconText, { color: colors.text }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* List switcher tabs */}
          {allLists && allLists.length > 1 && onSwitchList && (
            <View style={[styles.listTabsContainer, { borderBottomColor: colors.cardBorder }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listTabsScroll}
              >
                {allLists.map((l) => {
                  const isCurrent = l.id === activeListId;
                  return (
                    <TouchableOpacity
                      key={l.id}
                      style={[
                        styles.listTabChip,
                        {
                          backgroundColor: isCurrent
                            ? isBlack
                              ? '#1E293B'
                              : '#E2E8F0'
                            : 'transparent',
                          borderColor: isCurrent ? (l.color || '#3B82F6') : colors.cardBorder,
                        },
                      ]}
                      onPress={() => onSwitchList(l.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.listTabIcon}>{l.icon || '⭐'}</Text>
                      <Text
                        style={[
                          styles.listTabName,
                          {
                            color: isCurrent ? colors.text : colors.textMuted,
                            fontWeight: isCurrent ? '700' : '500',
                          },
                        ]}
                      >
                        {l.name}
                      </Text>
                      <Text style={[styles.listTabCount, { color: colors.textMuted }]}>
                        ({l.symbols.length})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Contor numar selectate si badge GitHub */}
          <View style={styles.controlsBar}>
            <View style={styles.badgeCounter}>
              <Text style={[styles.counterLabel, { color: colors.textMuted }]}>
                Selectate:
              </Text>
              <View
                style={[
                  styles.countPill,
                  {
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  },
                ]}
              >
                <Text style={[styles.countPillText, { color: '#3B82F6' }]}>
                  {selectedFavs.length} {selectedFavs.length === 1 ? 'simbol' : 'simboluri'}
                </Text>
              </View>
            </View>

            <View style={styles.unlimitedBadge}>
              <Text style={[styles.unlimitedText, { color: '#10B981' }]}>
                ✓ Sincronizat cu GitHub
              </Text>
            </View>
          </View>

          {/* Sectiunea de favorite selectate si ordonabile */}
          <View style={styles.selectedSection}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Ordine afișare ({selectedFavs.length}):
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedHorizontalScroll}
            >
              {selectedFavs.map((sym, idx) => (
                <View
                  key={sym}
                  style={[
                    styles.selectedChip,
                    {
                      backgroundColor: isBlack ? '#1E293B' : '#E2E8F0',
                      borderColor: '#3B82F6',
                    },
                  ]}
                >
                  <Text style={[styles.selectedChipText, { color: colors.text }]}>
                    {idx + 1}. {sym}
                  </Text>
                  <View style={styles.reorderArrows}>
                    <TouchableOpacity
                      onPress={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      style={styles.arrowSmall}
                    >
                      <Text style={{ fontSize: 10, color: idx === 0 ? '#94A3B8' : '#3B82F6' }}>
                        ◀
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleMoveDown(idx)}
                      disabled={idx === selectedFavs.length - 1}
                      style={styles.arrowSmall}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          color: idx === selectedFavs.length - 1 ? '#94A3B8' : '#3B82F6',
                        }}
                      >
                        ▶
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleToggle(sym)}
                    style={styles.removeChipBtn}
                  >
                    <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Search bar: existing GitHub watchlist symbols + new stock lookup */}
          <View style={styles.searchBarContainer}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: isBlack ? '#1E293B' : '#F1F5F9',
                  borderColor: colors.cardBorder,
                  color: colors.text,
                },
              ]}
              placeholder="Caută în watchlist-uri sau adaugă acțiuni noi (ex: AAPL, PLTR, VWCE.DE)..."
              placeholderTextColor={colors.inputPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Scrollable Symbol List: Existing GitHub Watchlists + New Stocks Search */}
          <ScrollView style={styles.symbolList} showsVerticalScrollIndicator={true}>
            {/* Direct ticker entry shortcut */}
            {directTickerCandidate ? (
              <TouchableOpacity
                style={[
                  styles.directAddRow,
                  {
                    backgroundColor: isBlack ? 'rgba(59, 130, 246, 0.14)' : '#EFF6FF',
                    borderColor: '#3B82F6',
                  },
                ]}
                onPress={handleAddDirectTicker}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.directAddTitle, { color: '#3B82F6' }]}>
                    + Adaugă simbolul „{directTickerCandidate}” în watchlist
                  </Text>
                  <Text style={[styles.directAddSubtitle, { color: colors.textMuted }]}>
                    Adaugă direct tickerul în lista activă (fără dependență de watchlist.csv)
                  </Text>
                </View>
                <View style={styles.directAddBtnBadge}>
                  <Text style={styles.directAddBtnBadgeText}>Adaugă</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Existing symbols across all GitHub watchlists */}
            <Text style={[styles.listGroupTitle, { color: colors.textMuted }]}>
              Simboluri existente în watchlist-uri ({filteredExisting.length})
            </Text>

            {filteredExisting.length === 0 ? (
              <Text style={[styles.emptyGroupText, { color: colors.textMuted }]}>
                {searchQuery.trim()
                  ? `Niciun simbol existent pentru „${searchQuery.trim()}”.`
                  : 'Nu există simboluri în watchlist-urile GitHub încă. Caută o acțiune mai sus pentru a adăuga.'}
              </Text>
            ) : (
              filteredExisting.map((item) => {
                const isChecked = selectedFavs.includes(item.symbol);
                return (
                  <TouchableOpacity
                    key={item.symbol}
                    style={[
                      styles.symbolRow,
                      {
                        borderBottomColor: isBlack ? '#1E293B' : '#F1F5F9',
                      },
                    ]}
                    onPress={() => handleToggle(item.symbol)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.symbolInfoCol}>
                      <View style={styles.symbolTopLine}>
                        <Text
                          style={[
                            styles.symbolTicker,
                            { color: isChecked ? '#3B82F6' : colors.text },
                          ]}
                        >
                          {item.symbol}
                        </Text>
                        {item.name ? (
                          <Text style={[styles.symbolName, { color: colors.textMuted }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                        ) : null}
                      </View>
                      {item.lists.length > 0 && (
                        <View style={styles.listMembershipRow}>
                          {item.lists.map((l) => (
                            <View
                              key={l.id}
                              style={[
                                styles.listMembershipBadge,
                                {
                                  backgroundColor: isBlack ? '#1E293B' : '#F1F5F9',
                                  borderColor: l.color || colors.cardBorder,
                                },
                              ]}
                            >
                              <Text style={[styles.listMembershipText, { color: colors.textMuted }]}>
                                {l.icon || '⭐'} {l.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isChecked ? '#3B82F6' : colors.cardBorder,
                          backgroundColor: isChecked ? '#3B82F6' : 'transparent',
                        },
                      ]}
                    >
                      {isChecked && <Text style={styles.checkIcon}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {/* Online search results for new stocks / ETFs */}
            {searchQuery.trim().length > 0 && (
              <View style={styles.remoteSection}>
                <View style={styles.remoteHeaderRow}>
                  <Text style={[styles.listGroupTitle, { color: colors.textMuted }]}>
                    Acțiuni & ETF-uri noi (Căutare piață)
                  </Text>
                  {isSearchingRemote && <ActivityIndicator size="small" color="#3B82F6" />}
                </View>

                {remoteError ? (
                  <Text style={[styles.emptyGroupText, { color: '#F59E0B' }]}>
                    {remoteError} Poți adăuga simbolul direct folosind butonul de mai sus.
                  </Text>
                ) : !isSearchingRemote && filteredRemoteNew.length === 0 ? (
                  <Text style={[styles.emptyGroupText, { color: colors.textMuted }]}>
                    Niciun rezultat nou găsit online pentru „{searchQuery.trim()}”.
                  </Text>
                ) : (
                  filteredRemoteNew.map((item) => {
                    const isChecked = selectedFavs.includes(item.symbol);
                    return (
                      <TouchableOpacity
                        key={`remote-${item.symbol}`}
                        style={[
                          styles.symbolRow,
                          {
                            borderBottomColor: isBlack ? '#1E293B' : '#F1F5F9',
                          },
                        ]}
                        onPress={() => handleToggle(item.symbol, item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.symbolInfoCol}>
                          <View style={styles.symbolTopLine}>
                            <Text
                              style={[
                                styles.symbolTicker,
                                { color: isChecked ? '#3B82F6' : colors.text },
                              ]}
                            >
                              {item.symbol}
                            </Text>
                            {item.name ? (
                              <Text style={[styles.symbolName, { color: colors.textMuted }]} numberOfLines={1}>
                                {item.name}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.symbolCategory, { color: colors.textMuted }]}>
                            {[item.category || 'Asset', item.exchange].filter(Boolean).join(' • ')}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.addStockPill,
                            {
                              backgroundColor: isChecked ? '#3B82F6' : 'rgba(16, 185, 129, 0.14)',
                              borderColor: isChecked ? '#3B82F6' : '#10B981',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.addStockPillText,
                              { color: isChecked ? '#FFFFFF' : '#10B981' },
                            ]}
                          >
                            {isChecked ? '✓ Adăugat' : '+ Adaugă'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footerRow, { borderTopColor: colors.cardBorder }]}>
            <TouchableOpacity
              style={[
                styles.resetBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.card },
              ]}
              onPress={handleResetSelection}
              activeOpacity={0.7}
            >
              <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>
                Resetează modificările
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, isSavingLocal && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isSavingLocal}
              activeOpacity={0.8}
            >
              {isSavingLocal ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Salvează în GitHub</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 720,
    height: '92%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    fontSize: 14,
    fontWeight: '700',
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  badgeCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  counterLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  unlimitedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  unlimitedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectedSection: {
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectedHorizontalScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  selectedChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reorderArrows: {
    flexDirection: 'row',
    gap: 4,
  },
  arrowSmall: {
    paddingHorizontal: 2,
  },
  removeChipBtn: {
    paddingHorizontal: 2,
  },
  searchBarContainer: {
    marginTop: 8,
    marginBottom: 6,
  },
  searchInput: {
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  symbolList: {
    flex: 1,
  },
  directAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  directAddTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  directAddSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  directAddBtnBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  directAddBtnBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  listGroupTitle: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
    marginBottom: 4,
  },
  emptyGroupText: {
    fontSize: 11,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  remoteSection: {
    marginTop: 10,
    paddingTop: 6,
  },
  remoteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    gap: 8,
  },
  symbolInfoCol: {
    flex: 1,
  },
  symbolTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolTicker: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 66,
  },
  symbolName: {
    fontSize: 11,
    flex: 1,
  },
  symbolCategory: {
    fontSize: 10,
    marginTop: 2,
  },
  listMembershipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  listMembershipBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.75,
  },
  listMembershipText: {
    fontSize: 9,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  addStockPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  addStockPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listTabsContainer: {
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  listTabsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  listTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  listTabIcon: {
    fontSize: 12,
  },
  listTabName: {
    fontSize: 11,
  },
  listTabCount: {
    fontSize: 10,
  },
});
