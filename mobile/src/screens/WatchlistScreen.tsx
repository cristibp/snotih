import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FavoriteCard from '../components/FavoriteCard';
import FavoriteListPicker from '../components/FavoriteListPicker';
import FavoritesBloombergGrid from '../components/FavoritesBloombergGrid';
import FavoritesComparisonChart from '../components/FavoritesComparisonChart';
import FavoritesSetupModal from '../components/FavoritesSetupModal';
import PollingDropdown from '../components/PollingDropdown';
import WatchlistChart from '../components/WatchlistChart';
import { useFavoriteLists } from '../hooks/useFavoriteLists';
import { useWatchlistPolling } from '../hooks/useWatchlistPolling';
import { useTheme } from '../theme/ThemeContext';
import { exitWebFullscreen, requestWebFullscreen } from '../services/fullscreen';

interface WatchlistScreenProps {
  isActive?: boolean;
  isKioskMode?: boolean;
  onToggleKiosk?: (enabled?: boolean) => void;
}

type ViewMode = 'detail' | 'grid' | 'compare';

export default function WatchlistScreen({
  isActive = true,
  isKioskMode: externalKioskMode,
  onToggleKiosk: externalToggleKiosk,
}: WatchlistScreenProps) {
  const { colors, isBlack } = useTheme();
  const [setupModalVisible, setSetupModalVisible] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [internalKioskMode, setInternalKioskMode] = useState<boolean>(false);

  const isKiosk = externalKioskMode !== undefined ? externalKioskMode : internalKioskMode;

  const handleToggleKiosk = (enable?: boolean) => {
    const next = enable !== undefined ? enable : !isKiosk;
    if (externalToggleKiosk) {
      externalToggleKiosk(next);
    } else {
      setInternalKioskMode(next);
      if (next) {
        requestWebFullscreen();
      } else {
        exitWebFullscreen();
      }
    }
  };

  // ─── Multi-Favorite Lists (GitHub-backed) ───
  const {
    allLists,
    activeList,
    activeListId,
    defaultListId,
    createList,
    updateListMeta,
    deleteListById,
    setDefault,
    setSymbols: setListSymbols,
    switchList,
    isLoading: listsLoading,
    isSaving: listsSaving,
    error: listsError,
  } = useFavoriteLists();

  // ─── Watchlist Polling (using external favorites from GitHub lists) ───
  const activeSymbols = activeList?.symbols || [];
  const {
    pollingInterval,
    setPollingInterval,
    favorites,
    allSymbols,
    selectedSymbol,
    setSelectedSymbol,
    quotes,
    isLoading,
    isRefreshing,
    error,
    countdown,
    manualRefresh,
  } = useWatchlistPolling(isActive, activeSymbols);

  // Wrapper to save favorites through the multi-list system
  const handleSaveFavorites = (newFavs: string[]) => {
    setListSymbols(newFavs);
  };

  return (
    <View style={[styles.container, isKiosk && styles.containerKiosk, { backgroundColor: colors.background }]}>
      {/* 2-Column Split Landscape Layout (800x420) */}
      <View style={styles.contentRow}>
        {/* Left Column: Favorites Sidebar (240px) */}
        {!isKiosk && !isSidebarCollapsed && (
          <View style={styles.leftColumn}>
            <View style={styles.sidebarHeader}>
              {/* Multi-List Picker replaces the old static title */}
              <FavoriteListPicker
                allLists={allLists}
                activeListId={activeListId}
                defaultListId={defaultListId}
                isSaving={listsSaving}
                onSwitchList={switchList}
                onCreateList={createList}
                onDeleteList={deleteListById}
                onUpdateList={updateListMeta}
                onSetDefault={setDefault}
              />

              <View style={styles.sidebarActions}>
                <TouchableOpacity
                  style={[
                    styles.setupIconBtn,
                    viewMode === 'grid' && { backgroundColor: isBlack ? '#334155' : '#E2E8F0', borderColor: '#3B82F6' },
                    {
                      backgroundColor: isBlack ? '#1E293B' : colors.card,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  onPress={() => setViewMode(viewMode === 'grid' ? 'detail' : 'grid')}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Comuta afisare multi-grafic favorite stil Bloomberg"
                >
                  <Text style={styles.setupIconText}>▦</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.setupIconBtn,
                    viewMode === 'compare' && { backgroundColor: isBlack ? '#334155' : '#E2E8F0', borderColor: '#3B82F6' },
                    {
                      backgroundColor: isBlack ? '#1E293B' : colors.card,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  onPress={() => setViewMode(viewMode === 'compare' ? 'detail' : 'compare')}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Comuta grafic comparativ favorite"
                >
                  <Text style={styles.setupIconText}>📊</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.setupIconBtn,
                    {
                      backgroundColor: isBlack ? '#1E293B' : colors.card,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  onPress={() => setSetupModalVisible(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Deschide configurarea simbolurilor favorite"
                >
                  <Text style={styles.setupIconText}>⚙️</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Loading state for lists */}
            {listsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                  Se încarcă listele...
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.cardsScroll}
                contentContainerStyle={styles.cardsContainer}
                showsVerticalScrollIndicator={false}
              >
                {favorites.map((sym) => (
                  <FavoriteCard
                    key={sym}
                    symbol={sym}
                    quote={quotes[sym]}
                    isSelected={sym === selectedSymbol}
                    onSelect={setSelectedSymbol}
                  />
                ))}
              </ScrollView>
            )}

            {/* Add favorites button */}
            <TouchableOpacity
              style={[
                styles.addFavBtn,
                {
                  borderColor: colors.cardBorder,
                },
              ]}
              onPress={() => setSetupModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.addFavText, { color: colors.textMuted }]}>
                + Adaugă simbol
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Right Column: Chart Area */}
        <View style={styles.rightColumn}>
          {/* Top Bar */}
          <View style={styles.topRightBar}>
            <View style={styles.viewModeTabs}>
              {!isSidebarCollapsed ? null : (
                <TouchableOpacity
                  style={[
                    styles.restoreSidebarBtn,
                    {
                      backgroundColor: isBlack ? '#1E293B' : colors.card,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  onPress={() => setIsSidebarCollapsed(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.restoreSidebarText, { color: colors.text }]}>☰</Text>
                </TouchableOpacity>
              )}
              {(['detail', 'grid', 'compare'] as ViewMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.viewModeTab,
                    viewMode === mode && [
                      styles.viewModeTabActive,
                      { backgroundColor: isBlack ? '#334155' : '#FFFFFF' },
                    ],
                  ]}
                  onPress={() => setViewMode(mode)}
                >
                  <Text
                    style={[
                      styles.viewModeTabText,
                      {
                        color: viewMode === mode ? colors.text : colors.textMuted,
                        fontWeight: viewMode === mode ? '700' : '500',
                      },
                    ]}
                  >
                    {mode === 'detail' ? 'Detalii' : mode === 'grid' ? 'Bloomberg' : 'Comparativ'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rightHeaderControls}>
              {error || listsError ? (
                <Text style={[styles.statusHint, { color: '#EF4444' }]} numberOfLines={1}>
                  {error || listsError}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.kioskScreenBtn,
                  {
                    backgroundColor: isBlack ? '#1E293B' : colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
                onPress={() => handleToggleKiosk()}
                activeOpacity={0.7}
              >
                <Text style={[styles.kioskScreenBtnText, { color: colors.text }]}>
                  {isKiosk ? '⬜ Ieșire' : '⬛ Kiosk'}
                </Text>
              </TouchableOpacity>

              <PollingDropdown
                currentInterval={pollingInterval}
                countdown={countdown}
                isRefreshing={isRefreshing}
                onSelectInterval={setPollingInterval}
                onManualRefresh={manualRefresh}
              />
            </View>
          </View>

          {/* Live Chart Container */}
          {viewMode === 'compare' ? (
            <FavoritesComparisonChart
              favorites={favorites}
              quotes={quotes}
              onSelectSymbol={(sym) => {
                setSelectedSymbol(sym);
                setViewMode('detail');
              }}
              isKiosk={isKiosk}
              onToggleKiosk={handleToggleKiosk}
            />
          ) : viewMode === 'grid' ? (
            <FavoritesBloombergGrid
              favorites={favorites}
              quotes={quotes}
              onSelectSymbol={(sym) => {
                setSelectedSymbol(sym);
                setViewMode('detail');
              }}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              isKiosk={isKiosk}
              onToggleKiosk={handleToggleKiosk}
              countdown={countdown}
              isRefreshing={isRefreshing}
              onManualRefresh={manualRefresh}
            />
          ) : selectedSymbol ? (
            <WatchlistChart
              symbol={selectedSymbol}
              quote={quotes[selectedSymbol]}
              isKiosk={isKiosk}
              onToggleKiosk={handleToggleKiosk}
              favorites={favorites}
              onSelectSymbol={setSelectedSymbol}
              countdown={countdown}
              isRefreshing={isRefreshing}
              onManualRefresh={manualRefresh}
            />
          ) : (
            <View style={styles.emptyChartState}>
              <Text style={[styles.emptyChartText, { color: colors.textMuted }]}>
                Selectează un simbol din stânga pentru a vizualiza graficul live.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Favorites Setup Modal — now multi-list aware */}
      <FavoritesSetupModal
        visible={setupModalVisible}
        allSymbols={allSymbols}
        currentFavorites={favorites}
        onSaveFavorites={handleSaveFavorites}
        onClose={() => setSetupModalVisible(false)}
        allLists={allLists}
        activeListId={activeListId}
        onSwitchList={switchList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  containerKiosk: {
    padding: 4,
    paddingRight: 28, // Pastreaza mai mult spatiu la dreapta pt modul kiosk
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  leftColumn: {
    width: 236,
    justifyContent: 'space-between',
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    zIndex: 100,
  },
  sidebarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setupIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupIconText: {
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
  },
  cardsScroll: {
    flex: 1,
    marginVertical: 4,
  },
  cardsContainer: {
    paddingBottom: 4,
  },
  addFavBtn: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFavText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rightColumn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topRightBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  viewModeTabs: {
    flexDirection: 'row',
    borderRadius: 7,
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
    padding: 2,
    gap: 3,
  },
  restoreSidebarBtn: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreSidebarText: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewModeTab: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  viewModeTabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  viewModeTabText: {
    fontSize: 11,
  },
  rightHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kioskScreenBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kioskScreenBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusHint: {
    fontSize: 10,
    maxWidth: 160,
  },
  emptyChartState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 12,
  },
});
