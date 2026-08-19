import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import TradingScreen from './src/screens/TradingScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'rates' | 'trading'>('rates');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.navBar}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'rates' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('rates')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, activeTab === 'rates' && styles.segmentTextActive]}>
              💶 Curs Valutar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'trading' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('trading')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, activeTab === 'trading' && styles.segmentTextActive]}>
              📈 Trading (RSI)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'rates' ? <HomeScreen /> : <TradingScreen />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#111827',
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
});
