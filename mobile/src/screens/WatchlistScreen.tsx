import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FavoriteCard from '../components/FavoriteCard';
import FavoritesComparisonChart from '../components/FavoritesComparisonChart';
import FavoritesSetupModal from '../components/FavoritesSetupModal';
import PollingDropdown from '../components/PollingDropdown';
import WatchlistChart from '../components/WatchlistChart';
import { useWatchlistPolling } from '../hooks/useWatchlistPolling';
import { useTheme } from '../theme/ThemeContext';

interface WatchlistScreenProps {
  isActive?: boolean;
}

export default function WatchlistScreen({ isActive = true }: WatchlistScreenProps) {
  const { colors, isBlack } = useTheme();
  const [setupModalVisible, setSetupModalVisible] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'detail' | 'compare'>('detail');

  const {
    pollingInterval,
    setPollingInterval,
    favorites,
    setFavorites,
    allSymbols,
    selectedSymbol,
    setSelectedSymbol,
    quotes,
    isLoading,
    isRefreshing,
    error,
    countdown,
    manualRefresh,
  } = useWatchlistPolling(isActive);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 2-Column Split Landscape Layout (800x420) */}
      <View style={styles.contentRow}>
        {/* Left Column: Favorites Sidebar (240px) */}
        <View style={styles.leftColumn}>
          <View style={styles.sidebarHeader}>
            <View style={styles.sidebarTitleRow}>
              <Text style={[styles.sidebarTitle, { color: colors.text }]}>Favorite</Text>
              <Text style={[styles.sidebarCount, { color: colors.textMuted }]}>
                ({favorites.length})
              </Text>
            </View>
            <View style={styles.sidebarActions}>
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
                accessibilityLabel="Configurare favorite"
              >
                <Text style={styles.setupIconText}>⚙️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cards List */}
          <View style={styles.cardsContainer}>
            {favorites.map((sym) => (
              <FavoriteCard
                key={sym}
                symbol={sym}
                quote={quotes[sym]}
                isSelected={selectedSymbol === sym && viewMode === 'detail'}
                onSelect={(selected) => {
                  setSelectedSymbol(selected);
                  setViewMode('detail');
                }}
              />
            ))}
          </View>

          {/* Bottom Setup Button */}
          <TouchableOpacity
            style={[
              styles.addFavBtn,
              {
                backgroundColor: isBlack ? '#1E293B' : colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
            onPress={() => setSetupModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.addFavText, { color: '#3B82F6' }]}>
              + Configurare ({favorites.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Right Column: Chart & Metrics Panel */}
        <View style={styles.rightColumn}>
          {/* Header Bar with Polling Dropdown & View Mode Switcher */}
          <View style={styles.topRightBar}>
            <View style={styles.viewModeTabs}>
              <TouchableOpacity
                style={[
                  styles.viewModeTab,
                  viewMode === 'detail' && [
                    styles.viewModeTabActive,
                    { backgroundColor: isBlack ? '#1E293B' : '#FFFFFF' },
                  ],
                ]}
                onPress={() => setViewMode('detail')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.viewModeTabText,
                    {
                      color: viewMode === 'detail' ? '#3B82F6' : colors.textMuted,
                      fontWeight: viewMode === 'detail' ? '700' : '500',
                    },
                  ]}
                >
                  📈 {selectedSymbol || 'Grafic Detaliat'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.viewModeTab,
                  viewMode === 'compare' && [
                    styles.viewModeTabActive,
                    { backgroundColor: isBlack ? '#1E293B' : '#FFFFFF' },
                  ],
                ]}
                onPress={() => setViewMode('compare')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.viewModeTabText,
                    {
                      color: viewMode === 'compare' ? '#3B82F6' : colors.textMuted,
                      fontWeight: viewMode === 'compare' ? '700' : '500',
                    },
                  ]}
                >
                  📊 Comparație Favorite
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rightHeaderControls}>
              {error ? (
                <Text style={[styles.statusHint, { color: '#EF4444' }]} numberOfLines={1}>
                  {error}
                </Text>
              ) : null}

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
            />
          ) : selectedSymbol ? (
            <WatchlistChart
              symbol={selectedSymbol}
              quote={quotes[selectedSymbol]}
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
        allSymbols={allSymbols}
        currentFavorites={favorites}
        onSaveFavorites={setFavorites}
        onClose={() => setSetupModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
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
  },
  sidebarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sidebarTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sidebarCount: {
    fontSize: 11,
    fontWeight: '600',
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
  cardsContainer: {
    flex: 1,
    justifyContent: 'flex-start',
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
