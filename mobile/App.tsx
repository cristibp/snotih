import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './src/screens/HomeScreen';
import WatchlistScreen from './src/screens/WatchlistScreen';
import TradingScreen from './src/screens/TradingScreen';
import RecessionScreen from './src/screens/RecessionScreen';
import GlobalSignalsScreen from './src/screens/GlobalSignalsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { DeviceProvider, useDevice } from './src/context/DeviceContext';
import { useAuth } from './src/hooks/useAuth';
import {
  addFullscreenChangeListener,
  exitWebFullscreen,
  requestWebFullscreen,
} from './src/services/fullscreen';

export type TabType = 'rates' | 'watchlist' | 'trading' | 'recession' | 'signals' | 'settings';
export const TAB_STORAGE_KEY = '@snotih_app_active_tab';

const TABS: { id: TabType; icon: string; label: string; shortLabel: string }[] = [
  { id: 'rates', icon: '💶', label: 'Curs', shortLabel: 'Curs' },
  { id: 'watchlist', icon: '📊', label: 'Watchlist', shortLabel: 'Watch' },
  { id: 'trading', icon: '🚨', label: 'Alerte', shortLabel: 'Alerte' },
  { id: 'signals', icon: '🌐', label: 'Piețe', shortLabel: 'Piețe' },
  { id: 'recession', icon: '📉', label: 'Recesiune', shortLabel: 'Risc' },
];

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
  const [isKioskMode, setIsKioskMode] = useState<boolean>(false);
  const [navModalOpen, setNavModalOpen] = useState<boolean>(false);
  const { isBlack, colors, toggleTheme } = useTheme();
  const { user, loading: authLoading, logout } = useAuth();
  const {
    isPhone,
    isLandscape,
    isAllview,
    profileIcon,
    profileShortLabel,
    profileLabel,
    cycleDeviceProfile,
    width,
  } = useDevice();

  // Ascultare evenimente browser fullscreen si tasta Escape pe Web
  useEffect(() => {
    const unsubscribeFs = addFullscreenChangeListener((isFullscreen) => {
      if (!isFullscreen && isKioskMode) {
        setIsKioskMode(false);
      }
    });

    const handleKeyDown = (e: any) => {
      if (e?.key === 'Escape' && isKioskMode) {
        setIsKioskMode(false);
        exitWebFullscreen();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      unsubscribeFs();
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isKioskMode]);

  const handleToggleKiosk = (enable?: boolean) => {
    const nextState = enable !== undefined ? enable : !isKioskMode;
    setIsKioskMode(nextState);
    if (nextState) {
      requestWebFullscreen();
    } else {
      exitWebFullscreen();
    }
  };

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

  // Pe telefon mobil în mod portrait sau ecran compact utilizăm bottom navigation bar
  const isMobilePortrait = (isPhone && !isLandscape) || (width < 680 && !isAllview);

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
            hidden={isKioskMode}
          />

          {/* ── TOP HEADER / NAVBAR ── */}
          {!isKioskMode && (
            isMobilePortrait ? (
              // Mobile Portrait Header (Compact)
              <View style={[styles.mobileHeader, { backgroundColor: colors.nav, borderBottomColor: colors.navBorder }]}>
                <View style={styles.mobileHeaderLeft}>
                  <Text style={[styles.mobileAppBrand, { color: colors.text }]}>SNOTI</Text>
                  <TouchableOpacity
                    style={[styles.mobileActiveBadge, { backgroundColor: colors.segmentActive }]}
                    onPress={() => setNavModalOpen(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Deschide meniul de secțiuni"
                  >
                    <Text style={[styles.mobileActiveBadgeText, { color: colors.text }]}>
                      {TABS.find((t) => t.id === activeTab)?.icon} {TABS.find((t) => t.id === activeTab)?.label || (activeTab === 'settings' ? 'Admin' : '')} ▾
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.mobileHeaderRight}>
                  {/* Device profile badge */}
                  <TouchableOpacity
                    style={[
                      styles.deviceBadge,
                      { backgroundColor: colors.toggleBtnBg, borderColor: colors.toggleBtnBorder },
                      isAllview && styles.deviceBadgeAllview,
                    ]}
                    onPress={cycleDeviceProfile}
                    activeOpacity={0.7}
                    accessibilityLabel={`Profil: ${profileLabel}. Apasă pentru a schimba.`}
                  >
                    <Text style={[styles.deviceBadgeText, { color: colors.text }]}>
                      {profileIcon} {profileShortLabel}
                    </Text>
                  </TouchableOpacity>

                  {/* Theme Toggle Button */}
                  <TouchableOpacity
                    style={[
                      styles.themeToggle,
                      { backgroundColor: colors.toggleBtnBg, borderColor: colors.toggleBtnBorder },
                    ]}
                    onPress={toggleTheme}
                    activeOpacity={0.7}
                    accessibilityLabel={isBlack ? 'Comută pe tema luminoasă' : 'Comută pe tema neagră'}
                  >
                    <Text style={styles.themeToggleIcon}>{isBlack ? '☀️' : '🌙'}</Text>
                  </TouchableOpacity>

                  {/* Admin Settings Button */}
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

                  {/* Logout Button */}
                  <TouchableOpacity
                    style={[
                      styles.themeToggle,
                      { borderColor: colors.toggleBtnBorder, backgroundColor: colors.toggleBtnBg },
                    ]}
                    onPress={logout}
                    activeOpacity={0.7}
                    accessibilityLabel="Sign out"
                  >
                    <Text style={styles.themeToggleIcon}>🚪</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Tablet / Allview / Desktop / Landscape Header
              <View style={[styles.navBar, { backgroundColor: colors.nav, borderBottomColor: colors.navBorder }]}>
                <View style={styles.navContentRow}>
                  <View style={[styles.segmentedControl, { backgroundColor: colors.segmentBackground }]}>
                    {TABS.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <TouchableOpacity
                          key={tab.id}
                          style={[
                            styles.segmentButton,
                            isActive && [styles.segmentButtonActive, { backgroundColor: colors.segmentActive }],
                          ]}
                          onPress={() => handleTabPress(tab.id)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              { color: colors.segmentText },
                              isActive && [styles.segmentTextActive, { color: colors.segmentTextActive }],
                            ]}
                            numberOfLines={1}
                          >
                            {tab.icon} {tab.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Device profile badge */}
                  <TouchableOpacity
                    style={[
                      styles.deviceBadge,
                      { backgroundColor: colors.toggleBtnBg, borderColor: colors.toggleBtnBorder },
                      isAllview && styles.deviceBadgeAllview,
                    ]}
                    onPress={cycleDeviceProfile}
                    activeOpacity={0.7}
                    accessibilityLabel={`Profil dispozitiv: ${profileLabel}. Apasă pentru comutare profil.`}
                  >
                    <Text style={[styles.deviceBadgeText, { color: colors.text }]}>
                      {profileIcon} {profileShortLabel}
                    </Text>
                  </TouchableOpacity>

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
                    <Text style={styles.themeToggleIcon}>{isBlack ? '☀️' : '🌙'}</Text>
                  </TouchableOpacity>

                  {/* Admin-only Settings button */}
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

                  {/* Logout button */}
                  <TouchableOpacity
                    style={[
                      styles.themeToggle,
                      { borderColor: colors.toggleBtnBorder, backgroundColor: colors.toggleBtnBg },
                    ]}
                    onPress={logout}
                    activeOpacity={0.7}
                    accessibilityLabel="Sign out"
                  >
                    <Text style={styles.themeToggleIcon}>🚪</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          )}

          {/* ── MAIN CONTENT AREA ── */}
          <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.tabContentPane, { display: activeTab === 'rates' ? 'flex' : 'none' }]}>
              <HomeScreen />
            </View>
            <View style={[styles.tabContentPane, { display: activeTab === 'watchlist' ? 'flex' : 'none' }]}>
              <WatchlistScreen
                isActive={activeTab === 'watchlist'}
                isKioskMode={isKioskMode}
                onToggleKiosk={handleToggleKiosk}
              />
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

          {/* ── MOBILE BOTTOM NAVIGATION BAR ── */}
          {!isKioskMode && isMobilePortrait && (
            <View style={[styles.bottomTabBar, { backgroundColor: colors.nav, borderTopColor: colors.navBorder }]}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.bottomTabButton,
                      isActive && [styles.bottomTabButtonActive, { backgroundColor: colors.segmentActive }],
                    ]}
                    onPress={() => handleTabPress(tab.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.bottomTabIcon}>{tab.icon}</Text>
                    <Text
                      style={[
                        styles.bottomTabText,
                        { color: isActive ? colors.text : colors.textMuted },
                        isActive && styles.bottomTabTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {tab.shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── FLOATING EXIT KIOSK BUTTON (Always visible in Kiosk Mode) ── */}
          {isKioskMode && (
            <TouchableOpacity
              style={styles.floatingExitKiosk}
              onPress={() => handleToggleKiosk(false)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ieșire din mod Kiosk"
            >
              <Text style={styles.floatingExitKioskText}>✕ Ieșire Kiosk</Text>
            </TouchableOpacity>
          )}

          {/* ── MOBILE QUICK SECTION NAVIGATION MODAL ── */}
          <Modal
            visible={navModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setNavModalOpen(false)}
          >
            <TouchableOpacity
              style={styles.navModalOverlay}
              activeOpacity={1}
              onPress={() => setNavModalOpen(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                style={[
                  styles.navModalContent,
                  {
                    backgroundColor: isBlack ? '#0F172A' : '#FFFFFF',
                    borderColor: colors.cardBorder,
                  },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={[styles.navModalHeader, { borderBottomColor: colors.cardBorder }]}>
                  <Text style={[styles.navModalTitle, { color: colors.text }]}>Secțiuni Aplicație</Text>
                  <TouchableOpacity
                    style={styles.navModalCloseBtn}
                    onPress={() => setNavModalOpen(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.navModalCloseText, { color: colors.textMuted }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.navModalItems}>
                  {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        style={[
                          styles.navModalItem,
                          isActive && [
                            styles.navModalItemActive,
                            { backgroundColor: isBlack ? '#1E293B' : '#EFF6FF' },
                          ],
                          { borderColor: isActive ? '#3B82F6' : colors.cardBorder },
                        ]}
                        onPress={() => {
                          handleTabPress(tab.id);
                          setNavModalOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.navModalItemIcon}>{tab.icon}</Text>
                        <View style={styles.navModalItemTextCol}>
                          <Text
                            style={[
                              styles.navModalItemLabel,
                              { color: isActive ? '#3B82F6' : colors.text },
                            ]}
                          >
                            {tab.label}
                          </Text>
                        </View>
                        {isActive && <Text style={styles.navModalCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}

                  {user.role === 'admin' && (
                    <TouchableOpacity
                      style={[
                        styles.navModalItem,
                        activeTab === 'settings' && [
                          styles.navModalItemActive,
                          { backgroundColor: isBlack ? '#1E293B' : '#EFF6FF' },
                        ],
                        { borderColor: activeTab === 'settings' ? '#3B82F6' : colors.cardBorder },
                      ]}
                      onPress={() => {
                        handleTabPress('settings');
                        setNavModalOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.navModalItemIcon}>⚙️</Text>
                      <View style={styles.navModalItemTextCol}>
                        <Text
                          style={[
                            styles.navModalItemLabel,
                            { color: activeTab === 'settings' ? '#3B82F6' : colors.text },
                          ]}
                        >
                          Panou Admin & Sesiuni
                        </Text>
                      </View>
                      {activeTab === 'settings' && <Text style={styles.navModalCheck}>✓</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </DeviceProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // Tablet / Desktop / Landscape Top Navbar
  navBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  navContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  segmentedControl: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 8,
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
  // Mobile Portrait Top Header
  mobileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  mobileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileAppBrand: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  mobileActiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mobileActiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mobileHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceBadgeAllview: {
    borderColor: '#3B82F6',
  },
  deviceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  themeToggle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggleIcon: {
    fontSize: 16,
  },
  contentContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  tabContentPane: {
    flex: 1,
    overflow: 'hidden',
  },
  // Mobile Portrait Bottom Navigation Bar
  bottomTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 6,
    borderTopWidth: 1,
    zIndex: 999,
    elevation: 8,
  },
  bottomTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  bottomTabButtonActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  bottomTabIcon: {
    fontSize: 16,
    marginBottom: 1,
  },
  bottomTabText: {
    fontSize: 10,
    fontWeight: '600',
  },
  bottomTabTextActive: {
    fontWeight: '800',
  },
  // Floating Exit Kiosk Button
  floatingExitKiosk: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 10,
    zIndex: 9999,
  },
  floatingExitKioskText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  // Quick Section Navigation Modal
  navModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  navModalContent: {
    width: '90%',
    maxWidth: 340,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
  },
  navModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  navModalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  navModalCloseBtn: {
    padding: 4,
  },
  navModalCloseText: {
    fontSize: 14,
    fontWeight: '700',
  },
  navModalItems: {
    padding: 10,
    gap: 6,
  },
  navModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  navModalItemActive: {
    borderWidth: 1.5,
  },
  navModalItemIcon: {
    fontSize: 20,
  },
  navModalItemTextCol: {
    flex: 1,
  },
  navModalItemLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  navModalCheck: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3B82F6',
  },
});
