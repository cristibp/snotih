import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './src/screens/HomeScreen';
import WatchlistScreen from './src/screens/WatchlistScreen';
import TradingScreen from './src/screens/TradingScreen';
import RecessionScreen from './src/screens/RecessionScreen';
import GlobalSignalsScreen from './src/screens/GlobalSignalsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useAuth } from './src/hooks/useAuth';

export type TabType = 'rates' | 'watchlist' | 'trading' | 'recession' | 'signals' | 'settings';
export const TAB_STORAGE_KEY = '@snotih_app_active_tab';

function getInitialTab(): TabType {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (
        stored === 'rates' ||
        stored === 'watchlist' ||
        stored === 'trading' ||
        stored === 'recession' ||
        stored === 'signals'
      ) {
        return stored;
      }
    }
  } catch (e) {
    // Ignore storage read error
  }
  return 'rates';
}

function MainApp() {
  const [activeTab, setActiveTabState] = useState<TabType>(getInitialTab);
  const { isBlack, colors, toggleTheme } = useTheme();
  const { user, loading: authLoading, logout } = useAuth();

  // Load persisted tab on mount (for native mobile via AsyncStorage)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const storedTab = await AsyncStorage.getItem(TAB_STORAGE_KEY);
        if (
          isMounted &&
          (storedTab === 'rates' ||
            storedTab === 'watchlist' ||
            storedTab === 'trading' ||
            storedTab === 'recession' ||
            storedTab === 'signals' ||
            storedTab === 'settings')
        ) {
          setActiveTabState(storedTab);
        }
      } catch (err) {
        console.warn('Failed to load active tab from storage:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleTabPress = (tab: TabType) => {
    setActiveTabState(tab);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TAB_STORAGE_KEY, tab);
      }
    } catch (e) {
      // Ignore storage write error
    }
    AsyncStorage.setItem(TAB_STORAGE_KEY, tab).catch((err) => {
      console.warn('Failed to save active tab to AsyncStorage:', err);
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* ── Auth loading splash ── */}
      {authLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      )}

      {/* ── Not signed in → show Login screen ── */}
      {!authLoading && !user && <LoginScreen />}

      {/* ── Signed in → show full app ── */}
      {!authLoading && user && (
        <>
          <StatusBar
            barStyle={colors.statusBar}
            backgroundColor={colors.nav}
          />
          <View style={[styles.navBar, { backgroundColor: colors.nav, borderBottomColor: colors.navBorder }]}>
            <View style={styles.navContentRow}>
              <View style={[styles.segmentedControl, { backgroundColor: colors.segmentBackground }]}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    activeTab === 'rates' && [styles.segmentButtonActive, { backgroundColor: colors.segmentActive }],
                  ]}
                  onPress={() => handleTabPress('rates')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: colors.segmentText },
                      activeTab === 'rates' && [styles.segmentTextActive, { color: colors.segmentTextActive }],
                    ]}
                    numberOfLines={1}
                  >
                    💶 Curs
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    activeTab === 'watchlist' && [styles.segmentButtonActive, { backgroundColor: colors.segmentActive }],
                  ]}
                  onPress={() => handleTabPress('watchlist')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: colors.segmentText },
                      activeTab === 'watchlist' && [styles.segmentTextActive, { color: colors.segmentTextActive }],
                    ]}
                    numberOfLines={1}
                  >
                    📊 Watchlist
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    activeTab === 'trading' && [styles.segmentButtonActive, { backgroundColor: colors.segmentActive }],
                  ]}
                  onPress={() => handleTabPress('trading')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: colors.segmentText },
                      activeTab === 'trading' && [styles.segmentTextActive, { color: colors.segmentTextActive }],
                    ]}
                    numberOfLines={1}
                  >
                    📈 RSI
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    activeTab === 'signals' && [styles.segmentButtonActive, { backgroundColor: colors.segmentActive }],
                  ]}
                  onPress={() => handleTabPress('signals')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: colors.segmentText },
                      activeTab === 'signals' && [styles.segmentTextActive, { color: colors.segmentTextActive }],
                    ]}
                    numberOfLines={1}
                  >
                    🌐 Piețe
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    activeTab === 'recession' && [styles.segmentButtonActive, { backgroundColor: colors.segmentActive }],
                  ]}
                  onPress={() => handleTabPress('recession')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: colors.segmentText },
                      activeTab === 'recession' && [styles.segmentTextActive, { color: colors.segmentTextActive }],
                    ]}
                    numberOfLines={1}
                  >
                    📉 Recesiune
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Theme Toggle Button */}
              <TouchableOpacity
                style={[
                  styles.themeToggle,
                  {
                    backgroundColor: colors.toggleBtnBg,
                    borderColor: colors.toggleBtnBorder,
                  },
                ]}
                onPress={toggleTheme}
                activeOpacity={0.7}
                accessibilityLabel={isBlack ? 'Comută pe tema luminoasă' : 'Comută pe tema neagră'}
              >
                <Text style={styles.themeToggleIcon}>
                  {isBlack ? '☀️' : '🌙'}
                </Text>
              </TouchableOpacity>

              {/* ── Admin-only Settings button ── */}
              {user.role === 'admin' && (
                <TouchableOpacity
                  style={[
                    styles.themeToggle,
                    activeTab === 'settings' && { backgroundColor: colors.segmentActive },
                    { borderColor: colors.toggleBtnBorder, backgroundColor: colors.toggleBtnBg },
                  ]}
                  onPress={() => handleTabPress('settings')}
                  activeOpacity={0.7}
                  accessibilityLabel="Admin Settings"
                >
                  <Text style={styles.themeToggleIcon}>⚙️</Text>
                </TouchableOpacity>
              )}

              {/* ── Logout button ── */}
              <TouchableOpacity
                style={[styles.themeToggle, { borderColor: colors.toggleBtnBorder, backgroundColor: colors.toggleBtnBg }]}
                onPress={logout}
                activeOpacity={0.7}
                accessibilityLabel="Sign out"
              >
                <Text style={styles.themeToggleIcon}>🚪</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.tabContentPane, { display: activeTab === 'rates' ? 'flex' : 'none' }]}>
              <HomeScreen />
            </View>
            <View style={[styles.tabContentPane, { display: activeTab === 'watchlist' ? 'flex' : 'none' }]}>
              <WatchlistScreen isActive={activeTab === 'watchlist'} />
            </View>
            <View style={[styles.tabContentPane, { display: activeTab === 'trading' ? 'flex' : 'none' }]}>
              <TradingScreen isActive={activeTab === 'trading'} />
            </View>
            <View style={[styles.tabContentPane, { display: activeTab === 'signals' ? 'flex' : 'none' }]}>
              <GlobalSignalsScreen isActive={activeTab === 'signals'} />
            </View>
            <View style={[styles.tabContentPane, { display: activeTab === 'recession' ? 'flex' : 'none' }]}>
              <RecessionScreen />
            </View>
            {/* Admin-only: Settings / Session Management */}
            {user.role === 'admin' && activeTab === 'settings' && (
              <View style={styles.tabContentPane}>
                <SettingsScreen currentUserEmail={user.email} />
              </View>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  navBar: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  navContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  segmentedControl: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  themeToggle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggleIcon: {
    fontSize: 18,
  },
  contentContainer: {
    flex: 1,
  },
  tabContentPane: {
    flex: 1,
  },
});
