import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './src/screens/HomeScreen';
import TradingScreen from './src/screens/TradingScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

export type TabType = 'rates' | 'trading';
export const TAB_STORAGE_KEY = '@snotih_app_active_tab';

function getInitialTab(): TabType {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (stored === 'rates' || stored === 'trading') {
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

  // Load persisted tab on mount (for native mobile via AsyncStorage)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const storedTab = await AsyncStorage.getItem(TAB_STORAGE_KEY);
        if (isMounted && (storedTab === 'rates' || storedTab === 'trading')) {
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
              >
                💶 Curs Valutar
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
              >
                📈 Trading (RSI)
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
        </View>
      </View>

      <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
        {activeTab === 'rates' ? <HomeScreen /> : <TradingScreen />}
      </View>
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
    paddingVertical: 8,
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
    fontSize: 13,
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
});
