import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  FlatList,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeContext';

export interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownSelectorProps {
  options: DropdownOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export default function DropdownSelector({
  options,
  selectedValue,
  onValueChange,
  placeholder = 'Selecteaza...',
}: DropdownSelectorProps) {
  const { colors, isBlack } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === selectedValue);

  const handleSelect = (value: string) => {
    onValueChange(value);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.triggerButton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: isBlack ? 1 : 1,
          },
        ]}
        activeOpacity={0.7}
        onPress={() => setIsOpen(true)}
      >
        <Text style={[styles.triggerText, { color: colors.text }]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 9l6 6 6-6"
            stroke={colors.textMuted}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: colors.modalContent,
                    borderColor: colors.cardBorder,
                    borderWidth: isBlack ? 1 : 0,
                  },
                ]}
              >
                <View style={[styles.modalHeader, { borderBottomColor: colors.modalHeaderBorder }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Alege intervalul</Text>
                </View>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => {
                    const isSelected = item.value === selectedValue;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          isSelected && [styles.optionItemActive, { backgroundColor: colors.optionItemActive }],
                        ]}
                        activeOpacity={0.6}
                        onPress={() => handleSelect(item.value)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            { color: colors.optionText },
                            isSelected && [styles.optionTextActive, { color: colors.optionTextActive }],
                          ]}
                        >
                          {item.label}
                        </Text>
                        {isSelected && (
                          <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M20 6L9 17l-5-5"
                              stroke={colors.primary}
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.divider }]} />}
                />
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
    width: '100%',
    marginVertical: 12,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  triggerText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionItemActive: {
    backgroundColor: '#F0FDF4',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
  },
  optionTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
});
