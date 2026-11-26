import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { useDevice } from '../context/DeviceContext';
import { exitWebFullscreen, requestWebFullscreen } from '../services/fullscreen';

interface WatchlistScreenProps {
  isActive?: boolean;
  isKioskMode?: boolean;
  onToggleKiosk?: (enabled?: boolean) => void;
}

type ViewMode = 'detail' | 'grid' | 'compare';
type MobileSubMode = 'chart' | 'cards';

export default function WatchlistScreen({
  isActive = true,
  isKioskMode: externalKioskMode,
  onToggleKiosk: externalToggleKiosk,
}: WatchlistScreenProps) {
  const { colors, isBlack } = useTheme();
  const { isPhone, isLandscape, isAllview, width } = useDevice();
  const [setupModalVisible, setSetupModalVisible] = useState<boolean>(false);
  const [setupInitialQuery, setSetupInitialQuery] = useState<string>('');
  const [sidebarSearch, setSidebarSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [mobileSubMode, setMobileSubMode] = useState<MobileSubMode>('chart');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [internalKioskMode, setInternalKioskMode] = useState<boolean>(false);

  const isKiosk = externalKioskMode !== undefined ? externalKioskMode : internalKioskMode;

  // Modul compact de telefon (portrait sau lățime mică sub 680px)
  const isMobileView = (isPhone && !isLandscape) || (width < 680 && !isAllview);

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
    removeSymbols,
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
    selectedSymbol,
    setSelectedSymbol,
    quotes,
    isLoading,
    isRefreshing,
    error,
    countdown,
    manualRefresh,
    refreshSymbol,
  } = useWatchlistPolling(isActive, activeSymbols);

  const openSetupModal = (initialQuery: string = '') => {
    setSetupInitialQuery(initialQuery);
    setSetupModalVisible(true);
  };

  // Wrapper to save favorites through the multi-list system
  const handleSaveFavorites = async (newFavs: string[]) => {
    await setListSymbols(newFavs);
  };

  const trimmedSidebarSearch = sidebarSearch.trim().toUpperCase();

  const filteredFavorites = useMemo(() => {
    if (!trimmedSidebarSearch) return favorites;
    return favorites.filter((sym) => {
      const name = quotes[sym]?.name || '';
      return (
        sym.toUpperCase().includes(trimmedSidebarSearch) ||
        name.toUpperCase().includes(trimmedSidebarSearch)
      );
    });
  }, [favorites, quotes, trimmedSidebarSearch]);

  const otherWatchlistMatches = useMemo(() => {
    if (!trimmedSidebarSearch) return [];
    const matches: { listId: string; listName: string; listIcon: string; listColor?: string; symbol: string }[] = [];
    allLists.forEach((list) => {
      if (list.id === activeListId) return;
      (list.symbols || []).forEach((sym) => {
        if (sym.toUpperCase().includes(trimmedSidebarSearch)) {
          matches.push({
            listId: list.id,
            listName: list.name,
            listIcon: list.icon || '⭐',
            listColor: list.color,
            symbol: sym,
          });
        }
      });
    });
    return matches.slice(0, 10);
  }, [allLists, activeListId, trimmedSidebarSearch]);

  const handleSelectFavoriteCard = (sym: string) => {
    setSelectedSymbol(sym);
    if (isMobileView && mobileSubMode === 'cards') {
      setMobileSubMode('chart');
    }
  };

  // ─── RENDER MOBILE PORTRAIT LAYOUT ───
  if (isMobileView) {
    return (
      <View style={[styles.containerMobile, { backgroundColor: colors.background }]}>
        {/* Top Control Bar for Mobile */}
        <View style={styles.mobileControlBar}>
          <View style={styles.mobileViewTabs}>
            {(['detail', 'grid', 'compare'] as ViewMode[]).map((mode) => {
              const active = viewMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.mobileViewTab,
                    active && [styles.viewModeTabActive, { backgroundColor: isBlack ? '#334155' : '#FFFFFF' }],
                  ]}
                  onPress={() => setViewMode(mode)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.mobileViewTabText,
                      {
                        color: active ? colors.text : colors.textMuted,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {mode === 'detail' ? 'Detalii' : mode === 'grid' ? 'Bloomberg' : 'Comparativ'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.mobileRightActions}>
            <TouchableOpacity
              style={[
                styles.kioskScreenBtn,
                isKiosk && { backgroundColor: '#EF4444', borderColor: '#EF4444' },
                !isKiosk && {
                  backgroundColor: isBlack ? '#1E293B' : colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
              onPress={() => handleToggleKiosk()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isKiosk ? 'Ieșire din Kiosk' : 'Ecran complet Kiosk'}
            >
              <Text
                style={[
                  styles.kioskScreenBtnText,
                  { color: isKiosk ? '#FFFFFF' : colors.text },
                ]}
              >
                {isKiosk ? '✕ Ieșire' : '⛶ Kiosk'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.setupIconBtn,
                {
                  backgroundColor: isBlack ? '#1E293B' : colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
              onPress={() => openSetupModal()}
              activeOpacity={0.7}
              accessibilityLabel="Configurare simboluri favorite"
            >
              <Text style={styles.setupIconText}>⚙️</Text>
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

        {/* In Detail Mode on Mobile: Horizontal Ticker / Chip Carousel & Submode Toggle */}
        {viewMode === 'detail' && (
          <View style={styles.mobileTickerSection}>
            <View style={styles.mobileTickerHeader}>
              <View style={styles.mobileListPickerWrap}>
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
              </View>

              <View style={styles.mobileSubmodeToggle}>
                <TouchableOpacity
                  style={[
                    styles.submodeBtn,
                    mobileSubMode === 'chart' && [styles.submodeBtnActive, { backgroundColor: isBlack ? '#3B82F6' : '#2563EB' }],
                  ]}
                  onPress={() => setMobileSubMode('chart')}
                >
                  <Text
                    style={[
                      styles.submodeText,
                      { color: mobileSubMode === 'chart' ? '#FFFFFF' : colors.textMuted },
                    ]}
                  >
                    📈 Grafic
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submodeBtn,
                    mobileSubMode === 'cards' && [styles.submodeBtnActive, { backgroundColor: isBlack ? '#3B82F6' : '#2563EB' }],
                  ]}
                  onPress={() => setMobileSubMode('cards')}
                >
                  <Text
                    style={[
                      styles.submodeText,
                      { color: mobileSubMode === 'cards' ? '#FFFFFF' : colors.textMuted },
                    ]}
                  >
                    📋 Listă ({favorites.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Horizontal Ticker Chips when in chart submode */}
            {mobileSubMode === 'chart' && favorites.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mobileTickerScroll}
              >
                {favorites.map((sym) => {
                  const q = quotes[sym];
                  const isSelected = sym === selectedSymbol;
                  const price = q?.price;
                  const changePct = q?.changePercent;
                  const isPos = (changePct ?? 0) >= 0;

                  return (
                    <TouchableOpacity
                      key={sym}
                      style={[
                        styles.mobileTickerChip,
                        {
                          backgroundColor: isSelected
                            ? isBlack ? '#1E293B' : '#EFF6FF'
                            : isBlack ? '#0F172A' : colors.card,
                          borderColor: isSelected
                            ? '#3B82F6'
                            : colors.cardBorder,
                          borderWidth: isSelected ? 1.5 : 1,
                        },
                      ]}
                      onPress={() => setSelectedSymbol(sym)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.chipTopRow}>
                        <Text
                          style={[
                            styles.chipSymbol,
                            { color: isSelected ? '#3B82F6' : colors.text },
                          ]}
                        >
                          {sym}
                        </Text>
                        {changePct !== undefined && (
                          <Text
                            style={[
                              styles.chipChange,
                              { color: isPos ? '#10B981' : '#EF4444' },
                            ]}
                          >
                            {isPos ? '+' : ''}{changePct.toFixed(1)}%
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.chipPrice, { color: colors.text }]}>
                        {price !== undefined ? `${price.toFixed(2)}` : '...'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[
                    styles.mobileAddChip,
                    { borderColor: colors.cardBorder, backgroundColor: isBlack ? '#0F172A' : colors.card },
                  ]}
                  onPress={() => openSetupModal()}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.mobileAddChipText, { color: colors.textMuted }]}>+ Simbol</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        )}

        {/* Mobile Main Body */}
        <View style={styles.mobileBody}>
          {viewMode === 'compare' ? (
            <FavoritesComparisonChart
              favorites={favorites}
              quotes={quotes}
              onSelectSymbol={(sym) => {
                setSelectedSymbol(sym);
                setViewMode('detail');
                setMobileSubMode('chart');
              }}
              isKiosk={isKiosk}
              onToggleKiosk={handleToggleKiosk}
            />
          ) : viewMode === 'grid' ? (
            <FavoritesBloombergGrid
              favorites={favorites}
              quotes={quotes}
              listId={activeList?.id || activeListId}
              onRefreshSymbol={refreshSymbol}
              onRemoveSymbol={(sym) => removeSymbols([sym])}
              onOpenAddModal={(q) => openSetupModal(q || '')}
              allLists={allLists}
              onSwitchListAndSelect={(listId, sym) => {
                switchList(listId);
                setSelectedSymbol(sym);
              }}
              onSelectSymbol={(sym) => {
                setSelectedSymbol(sym);
                setViewMode('detail');
                setMobileSubMode('chart');
              }}
              isSidebarCollapsed={true}
              onToggleSidebar={() => {
                setViewMode('detail');
                setMobileSubMode('cards');
              }}
              isKiosk={isKiosk}
              onToggleKiosk={handleToggleKiosk}
              countdown={countdown}
              isRefreshing={isRefreshing}
              onManualRefresh={manualRefresh}
            />
          ) : mobileSubMode === 'cards' ? (
            // Full width vertical card list on mobile
            <ScrollView
              style={styles.mobileCardsList}
              contentContainerStyle={styles.mobileCardsContent}
              showsVerticalScrollIndicator={true}
            >
              <View
                style={[
                  styles.sidebarSearchBox,
                  {
                    backgroundColor: isBlack ? '#0F172A' : '#F1F5F9',
                    borderColor: colors.cardBorder,
                    marginBottom: 8,
                  },
                ]}
              >
                <TextInput
                  style={[styles.sidebarSearchInput, { color: colors.text }]}
                  value={sidebarSearch}
                  onChangeText={setSidebarSearch}
                  placeholder="🔍 Caută în watchlist-uri..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
                {sidebarSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setSidebarSearch('')} style={styles.sidebarSearchClear}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {listsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                  <Text style={[styles.loadingText, { color: colors.textMuted }]}>Se încarcă listele...</Text>
                </View>
              ) : filteredFavorites.length === 0 ? (
                <View style={styles.emptyChartState}>
                  <Text style={[styles.emptyChartText, { color: colors.textMuted }]}>
                    {trimmedSidebarSearch
                      ? `Niciun simbol găsit pentru „${sidebarSearch.trim()}” în lista activă.`
                      : 'Niciun simbol în această listă. Adaugă simboluri folosind butonul de mai jos.'}
                  </Text>
                </View>
              ) : (
                filteredFavorites.map((sym) => (
                  <FavoriteCard
                    key={sym}
                    symbol={sym}
                    quote={quotes[sym]}
                    isSelected={sym === selectedSymbol}
                    onSelect={handleSelectFavoriteCard}
                  />
                ))
              )}

              {otherWatchlistMatches.length > 0 && (
                <View style={styles.otherMatchesBox}>
                  <Text style={[styles.otherMatchesTitle, { color: colors.textMuted }]}>
                    În alte watchlist-uri:
                  </Text>
                  {otherWatchlistMatches.map((m) => (
                    <TouchableOpacity
                      key={`${m.listId}-${m.symbol}`}
                      style={[
                        styles.otherMatchRow,
                        { backgroundColor: isBlack ? '#0F172A' : colors.card, borderColor: m.listColor || colors.cardBorder },
                      ]}
                      onPress={() => {
                        switchList(m.listId);
                        handleSelectFavoriteCard(m.symbol);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.otherMatchSymbol, { color: '#3B82F6' }]}>{m.symbol}</Text>
                      <Text style={[styles.otherMatchListName, { color: colors.textMuted }]}>
                        {m.listIcon} {m.listName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.addFavBtn, { borderColor: colors.cardBorder, marginTop: 8 }]}
                onPress={() => openSetupModal(sidebarSearch.trim())}
                activeOpacity={0.7}
              >
                <Text style={[styles.addFavText, { color: colors.textMuted }]}>
                  {trimmedSidebarSearch
                    ? `+ Adaugă „${trimmedSidebarSearch}” ca acțiune nouă`
                    : '+ Adaugă simbol în listă'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : selectedSymbol ? (
            // Full width Chart on mobile
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
                Selectează un simbol din carusel pentru a vizualiza graficul live.
              </Text>
            </View>
          )}
        </View>

        {/* Floating exit kiosk button when in kiosk mode on mobile */}
        {isKiosk && (
          <TouchableOpacity
            style={styles.floatingKioskExitBtn}
            onPress={() => handleToggleKiosk(false)}
            activeOpacity={0.8}
            accessibilityLabel="Ieșire din ecran complet Kiosk"
          >
            <Text style={styles.floatingKioskExitText}>✕ Ieșire Kiosk</Text>
          </TouchableOpacity>
        )}

        {/* Setup Modal */}
        <FavoritesSetupModal
          visible={setupModalVisible}
          currentFavorites={favorites}
          quotes={quotes}
          initialSearchQuery={setupInitialQuery}
          onSaveFavorites={handleSaveFavorites}
          onClose={() => setSetupModalVisible(false)}
          allLists={allLists}
          activeListId={activeListId}
          onSwitchList={switchList}
        />
      </View>
    );
  }

  // ─── RENDER ALLVIEW / TABLET / DESKTOP LANDSCAPE LAYOUT ───
  return (
    <View style={[styles.container, isKiosk && styles.containerKiosk, { backgroundColor: colors.background }]}>
      {/* 2-Column Split Landscape Layout (800x420 & Tablets) */}
      <View style={styles.contentRow}>
        {/* Left Column: Favorites Sidebar (236px) */}
        {!isKiosk && !isSidebarCollapsed && (
          <View style={styles.leftColumn}>
            <View style={styles.sidebarHeader}>
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
                  onPress={() => openSetupModal()}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Deschide configurarea simbolurilor favorite"
                >
                  <Text style={styles.setupIconText}>⚙️</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search existing symbols across GitHub watchlists */}
            <View
              style={[
                styles.sidebarSearchBox,
                {
                  backgroundColor: isBlack ? '#0F172A' : '#F1F5F9',
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <TextInput
                style={[styles.sidebarSearchInput, { color: colors.text }]}
                value={sidebarSearch}
                onChangeText={setSidebarSearch}
                placeholder="🔍 Caută în watchlist-uri..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
              {sidebarSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSidebarSearch('')} style={styles.sidebarSearchClear}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Loading state for lists */}
            {listsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>Se încarcă listele...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.cardsScroll}
                contentContainerStyle={styles.cardsContainer}
                showsVerticalScrollIndicator={false}
              >
                {filteredFavorites.length === 0 ? (
                  <Text style={[styles.emptyFilterText, { color: colors.textMuted }]}>
                    {trimmedSidebarSearch
                      ? `Nimic găsit pentru „${sidebarSearch.trim()}” în lista activă.`
                      : 'Lista este goală.'}
                  </Text>
                ) : (
                  filteredFavorites.map((sym) => (
                    <FavoriteCard
                      key={sym}
                      symbol={sym}
                      quote={quotes[sym]}
                      isSelected={sym === selectedSymbol}
                      onSelect={setSelectedSymbol}
                    />
                  ))
                )}

                {otherWatchlistMatches.length > 0 && (
                  <View style={styles.otherMatchesBox}>
                    <Text style={[styles.otherMatchesTitle, { color: colors.textMuted }]}>
                      În alte liste:
                    </Text>
                    {otherWatchlistMatches.map((m) => (
                      <TouchableOpacity
                        key={`${m.listId}-${m.symbol}`}
                        style={[
                          styles.otherMatchRow,
                          { backgroundColor: isBlack ? '#0F172A' : colors.card, borderColor: m.listColor || colors.cardBorder },
                        ]}
                        onPress={() => {
                          switchList(m.listId);
                          setSelectedSymbol(m.symbol);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.otherMatchSymbol, { color: '#3B82F6' }]}>{m.symbol}</Text>
                        <Text style={[styles.otherMatchListName, { color: colors.textMuted }]} numberOfLines={1}>
                          {m.listIcon} {m.listName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
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
              onPress={() => openSetupModal(sidebarSearch.trim())}
              activeOpacity={0.7}
            >
              <Text style={[styles.addFavText, { color: colors.textMuted }]}>
                {trimmedSidebarSearch
                  ? `+ Adaugă „${trimmedSidebarSearch}”`
                  : '+ Adaugă simbol'}
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
              listId={activeList?.id || activeListId}
              onRefreshSymbol={refreshSymbol}
              onRemoveSymbol={(sym) => removeSymbols([sym])}
              onOpenAddModal={(q) => openSetupModal(q || '')}
              allLists={allLists}
              onSwitchListAndSelect={(listId, sym) => {
                switchList(listId);
                setSelectedSymbol(sym);
              }}
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

      {/* Favorites Setup Modal */}
      <FavoritesSetupModal
        visible={setupModalVisible}
        currentFavorites={favorites}
        quotes={quotes}
        initialSearchQuery={setupInitialQuery}
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
  // Allview / Tablet / Desktop Layout
  container: {
    flex: 1,
    padding: 8,
  },
  containerKiosk: {
    padding: 4,
    paddingRight: 28,
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
    paddingVertical: 20,
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
  sidebarSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    height: 30,
    marginBottom: 4,
  },
  sidebarSearchInput: {
    flex: 1,
    fontSize: 11,
    paddingVertical: 2,
  },
  sidebarSearchClear: {
    paddingLeft: 6,
  },
  emptyFilterText: {
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 14,
  },
  otherMatchesBox: {
    marginTop: 6,
    gap: 4,
  },
  otherMatchesTitle: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  otherMatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  otherMatchSymbol: {
    fontSize: 11,
    fontWeight: '800',
  },
  otherMatchListName: {
    fontSize: 10,
    flexShrink: 1,
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
    padding: 16,
  },
  emptyChartText: {
    fontSize: 12,
    textAlign: 'center',
  },

  // ─── Mobile Portrait Specific Styles ───
  containerMobile: {
    flex: 1,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 2,
  },
  mobileControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mobileViewTabs: {
    flexDirection: 'row',
    borderRadius: 7,
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
    padding: 2,
    gap: 2,
  },
  mobileViewTab: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  mobileViewTabText: {
    fontSize: 11,
  },
  mobileRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mobileTickerSection: {
    marginBottom: 6,
  },
  mobileTickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  mobileListPickerWrap: {
    flex: 1,
  },
  mobileSubmodeToggle: {
    flexDirection: 'row',
    borderRadius: 6,
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
    padding: 2,
    gap: 2,
  },
  submodeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  submodeBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  submodeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mobileTickerScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  mobileTickerChip: {
    minWidth: 84,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    justifyContent: 'center',
  },
  chipTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  chipSymbol: {
    fontSize: 11,
    fontWeight: '800',
  },
  chipChange: {
    fontSize: 9,
    fontWeight: '700',
  },
  chipPrice: {
    fontSize: 12,
    fontWeight: '700',
  },
  mobileAddChip: {
    width: 68,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  mobileAddChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mobileBody: {
    flex: 1,
  },
  mobileCardsList: {
    flex: 1,
  },
  mobileCardsContent: {
    paddingBottom: 16,
  },
  floatingKioskExitBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    zIndex: 9999,
  },
  floatingKioskExitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
