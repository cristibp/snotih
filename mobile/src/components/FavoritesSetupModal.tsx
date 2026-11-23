import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FavoriteList, WatchlistSymbolMeta } from '../api/types';
import { DEFAULT_FAVORITES } from '../hooks/useWatchlistPolling';
import { useTheme } from '../theme/ThemeContext';

interface FavoritesSetupModalProps {
  visible: boolean;
  allSymbols: WatchlistSymbolMeta[];
  currentFavorites: string[];
  onSaveFavorites: (newFavorites: string[]) => void;
  onClose: () => void;
  allLists?: FavoriteList[];
  activeListId?: string;
  onSwitchList?: (listId: string) => void;
}

export default function FavoritesSetupModal({
  visible,
  allSymbols,
  currentFavorites,
  onSaveFavorites,
  onClose,
  allLists,
  activeListId,
  onSwitchList,
}: FavoritesSetupModalProps) {
  const { colors, isBlack } = useTheme();
  const [selectedFavs, setSelectedFavs] = useState<string[]>(currentFavorites);
  const [capLimit, setCapLimit] = useState<number>(5);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeList = useMemo(
    () => allLists?.find((l) => l.id === activeListId) || null,
    [allLists, activeListId]
  );

  // Sincronizare la deschidere
  React.useEffect(() => {
    if (visible) {
      setSelectedFavs(currentFavorites);
      setCapLimit(Math.max(5, currentFavorites.length));
      setSearchQuery('');
    }
  }, [visible, currentFavorites]);

  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) {
      return allSymbols;
    }
    const q = searchQuery.trim().toUpperCase();
    return allSymbols.filter(
      (s) =>
        s.symbol.toUpperCase().includes(q) ||
        (s.name && s.name.toUpperCase().includes(q)) ||
        (s.category && s.category.toUpperCase().includes(q))
    );
  }, [allSymbols, searchQuery]);

  const handleToggle = (symbol: string) => {
    const isSelected = selectedFavs.includes(symbol);
    if (isSelected) {
      setSelectedFavs(selectedFavs.filter((s) => s !== symbol));
    } else {
      if (selectedFavs.length >= capLimit) {
        return; // Atingem limita maxima admisa
      }
      setSelectedFavs([...selectedFavs, symbol]);
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

  const handleResetDefaults = () => {
    setSelectedFavs(DEFAULT_FAVORITES);
    setCapLimit(5);
  };

  const handleSave = () => {
    if (selectedFavs.length > 0) {
      onSaveFavorites(selectedFavs);
    }
    onClose();
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
            <View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Configurare Simboluri Favorite
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                {activeList
                  ? `Listă: ${activeList.icon || '⭐'} ${activeList.name} • până la ${capLimit} simboluri`
                  : `Selectează până la ${capLimit} simboluri pentru ecranul 800×480 WVGA`}
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

          {/* Stepper limita si Badge numar selectate */}
          <View style={styles.controlsBar}>
            <View style={styles.badgeCounter}>
              <Text style={[styles.counterLabel, { color: colors.textMuted }]}>
                Selectate:
              </Text>
              <View
                style={[
                  styles.countPill,
                  {
                    backgroundColor:
                      selectedFavs.length === capLimit
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(59, 130, 246, 0.2)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countPillText,
                    {
                      color:
                        selectedFavs.length === capLimit ? '#F59E0B' : '#3B82F6',
                    },
                  ]}
                >
                  {selectedFavs.length} / {capLimit}
                </Text>
              </View>
            </View>

            {/* Stepper pentru limita cap X */}
            <View style={styles.capStepper}>
              <Text style={[styles.stepperLabel, { color: colors.textMuted }]}>
                Cap ecran:
              </Text>
              <TouchableOpacity
                style={[styles.stepBtn, { borderColor: colors.cardBorder }]}
                onPress={() => setCapLimit(Math.max(2, capLimit - 1))}
                disabled={capLimit <= 2}
              >
                <Text style={[styles.stepBtnText, { color: colors.text }]}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.capNumber, { color: colors.text }]}>{capLimit}</Text>
              <TouchableOpacity
                style={[styles.stepBtn, { borderColor: colors.cardBorder }]}
                onPress={() => setCapLimit(Math.min(8, capLimit + 1))}
                disabled={capLimit >= 8}
              >
                <Text style={[styles.stepBtnText, { color: colors.text }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {capLimit > 5 && (
            <Text style={styles.advisoryText}>
              ⚠️ Setarea a mai mult de 5 favorite poate necesita scroll vertical pe Allview AX4 Nano (480px).
            </Text>
          )}

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

          {/* Search bar */}
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
              placeholder="Caută după ticker sau nume (ex: AAPL, VWCE, EMIM)..."
              placeholderTextColor={colors.inputPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Scrollable Symbol List */}
          <ScrollView style={styles.symbolList} showsVerticalScrollIndicator={true}>
            {filteredCatalog.map((item) => {
              const isChecked = selectedFavs.includes(item.symbol);
              const isDisabled = !isChecked && selectedFavs.length >= capLimit;

              return (
                <TouchableOpacity
                  key={item.symbol}
                  style={[
                    styles.symbolRow,
                    {
                      borderBottomColor: isBlack ? '#1E293B' : '#F1F5F9',
                      opacity: isDisabled ? 0.45 : 1,
                    },
                  ]}
                  onPress={() => handleToggle(item.symbol)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                >
                  <View style={styles.symbolInfo}>
                    <Text
                      style={[
                        styles.symbolTicker,
                        { color: isChecked ? '#3B82F6' : colors.text },
                      ]}
                    >
                      {item.symbol}
                    </Text>
                    <Text style={[styles.symbolCategory, { color: colors.textMuted }]}>
                      {item.category || 'Asset'}
                    </Text>
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
            })}
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footerRow, { borderTopColor: colors.cardBorder }]}>
            <TouchableOpacity
              style={[
                styles.resetBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.card },
              ]}
              onPress={handleResetDefaults}
              activeOpacity={0.7}
            >
              <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>
                Resetează la implicite
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>Salvează & Aplică</Text>
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
  capStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperLabel: {
    fontSize: 11,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  capNumber: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  advisoryText: {
    fontSize: 10,
    color: '#F59E0B',
    marginTop: 4,
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
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  symbolList: {
    flex: 1,
  },
  symbolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
  },
  symbolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolTicker: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 70,
  },
  symbolCategory: {
    fontSize: 11,
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
