import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { POLLING_INTERVAL_OPTIONS } from '../hooks/useWatchlistPolling';
import { useTheme } from '../theme/ThemeContext';

interface PollingDropdownProps {
  currentInterval: number;
  countdown: number;
  isRefreshing: boolean;
  onSelectInterval: (seconds: number) => void;
  onManualRefresh: () => void;
}

export default function PollingDropdown({
  currentInterval,
  countdown,
  isRefreshing,
  onSelectInterval,
  onManualRefresh,
}: PollingDropdownProps) {
  const { colors, isBlack } = useTheme();
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const activeOption =
    POLLING_INTERVAL_OPTIONS.find((opt) => opt.value === currentInterval) ||
    POLLING_INTERVAL_OPTIONS[1];

  return (
    <View style={styles.container}>
      {/* Selector Pill */}
      <TouchableOpacity
        style={[
          styles.pillButton,
          {
            backgroundColor: isBlack ? '#1E293B' : colors.card,
            borderColor: colors.cardBorder,
          },
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
        accessibilityRole="combobox"
        accessibilityLabel={`Interval actualizare: ${activeOption.label}`}
      >
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isRefreshing ? '#F59E0B' : '#10B981' },
          ]}
        />
        <Text style={[styles.pillText, { color: colors.text }]}>
          {isRefreshing ? 'Sync...' : `${countdown}s (${activeOption.label.split(' ')[0]})`}
        </Text>
        <Text style={[styles.arrowText, { color: colors.textMuted }]}>▼</Text>
      </TouchableOpacity>

      {/* Manual Refresh Button */}
      <TouchableOpacity
        style={[
          styles.refreshButton,
          {
            backgroundColor: isBlack ? '#1E293B' : colors.card,
            borderColor: colors.cardBorder,
          },
        ]}
        onPress={onManualRefresh}
        activeOpacity={0.7}
        disabled={isRefreshing}
        accessibilityRole="button"
        accessibilityLabel="Actualizează acum"
      >
        <Text style={styles.refreshIcon}>🔄</Text>
      </TouchableOpacity>

      {/* Modal Dropdown Selection */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: isBlack ? '#0F172A' : '#FFFFFF',
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Cadenta actualizare live
                </Text>

                {POLLING_INTERVAL_OPTIONS.map((opt) => {
                  const isSelected = opt.value === currentInterval;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: isSelected
                            ? isBlack
                              ? '#1E293B'
                              : '#E2E8F0'
                            : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        onSelectInterval(opt.value);
                        setModalVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            color: isSelected ? '#3B82F6' : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    height: 32,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  arrowText: {
    fontSize: 9,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: 260,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginVertical: 2,
  },
  optionLabel: {
    fontSize: 12,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B82F6',
  },
});
