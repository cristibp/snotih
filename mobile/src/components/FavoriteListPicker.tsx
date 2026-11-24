import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FavoriteList } from '../api/types';
import { useTheme } from '../theme/ThemeContext';

interface FavoriteListPickerProps {
  allLists: FavoriteList[];
  activeListId: string;
  defaultListId: string;
  isSaving: boolean;
  onSwitchList: (listId: string) => void;
  onCreateList: (name: string, symbols?: string[], icon?: string, color?: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onUpdateList: (listId: string, patch: Partial<Pick<FavoriteList, 'name' | 'icon' | 'color'>>) => Promise<void>;
  onSetDefault: (listId: string) => Promise<void>;
}

const LIST_ICONS = ['⭐', '📈', '🇪🇺', '🇺🇸', '💎', '🔥', '🏦', '🛡️', '🚀', '📊', '💰', '🌍'];
const LIST_COLORS = ['#3B82F6', '#10B981', '#A855F7', '#F59E0B', '#EC4899', '#06B6D4', '#F97316', '#6366F1'];

export default function FavoriteListPicker({
  allLists,
  activeListId,
  defaultListId,
  isSaving,
  onSwitchList,
  onCreateList,
  onDeleteList,
  onUpdateList,
  onSetDefault,
}: FavoriteListPickerProps) {
  const { colors, isBlack } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<FavoriteList | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListIcon, setNewListIcon] = useState('⭐');
  const [newListColor, setNewListColor] = useState('#3B82F6');

  const activeList = allLists.find((l) => l.id === activeListId);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      await onCreateList(newListName.trim(), [], newListIcon, newListColor);
      setIsCreateModalOpen(false);
      setNewListName('');
      setNewListIcon('⭐');
      setNewListColor('#3B82F6');
    } catch (e) {
      // error already handled by hook
    }
  };

  const handleEditList = async () => {
    if (!editingList || !newListName.trim()) return;
    try {
      await onUpdateList(editingList.id, {
        name: newListName.trim(),
        icon: newListIcon,
        color: newListColor,
      });
      setIsEditModalOpen(false);
      setEditingList(null);
    } catch (e) {
      // error already handled by hook
    }
  };

  const openEditModal = (list: FavoriteList) => {
    setEditingList(list);
    setNewListName(list.name);
    setNewListIcon(list.icon || '⭐');
    setNewListColor(list.color || '#3B82F6');
    setIsEditModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleDeleteList = async (listId: string) => {
    setIsDropdownOpen(false);
    try {
      await onDeleteList(listId);
    } catch (e) {
      // error already handled by hook
    }
  };

  return (
    <View style={styles.container}>
      {/* Active List Pill (tap to toggle dropdown) */}
      <TouchableOpacity
        style={[
          styles.activePill,
          {
            backgroundColor: isBlack ? '#1E293B' : colors.card,
            borderColor: activeList?.color || colors.cardBorder,
          },
        ]}
        onPress={() => setIsDropdownOpen(!isDropdownOpen)}
        activeOpacity={0.7}
      >
        <Text style={styles.activeIcon}>{activeList?.icon || '⭐'}</Text>
        <Text style={[styles.activeName, { color: colors.text }]} numberOfLines={1}>
          {activeList?.name || 'Favorite'}
        </Text>
        <Text style={[styles.activeCount, { color: colors.textMuted }]}>
          ({activeList?.symbols.length || 0})
        </Text>
        <Text style={[styles.chevron, { color: colors.textMuted }]}>
          {isDropdownOpen ? '▲' : '▼'}
        </Text>
        {isSaving && <ActivityIndicator size="small" color={colors.textMuted} style={styles.savingIndicator} />}
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={isDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDropdownOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.dropdownModalContent,
              {
                backgroundColor: isBlack ? '#0F172A' : '#FFFFFF',
                borderColor: colors.cardBorder,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.dropdownHeader, { borderBottomColor: colors.cardBorder }]}>
              <Text style={[styles.dropdownHeaderTitle, { color: colors.text }]}>
                Alege Watchlist ({allLists.length})
              </Text>
              <TouchableOpacity
                style={styles.dropdownCloseBtn}
                onPress={() => setIsDropdownOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.dropdownCloseText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
              {allLists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={[
                    styles.dropdownItem,
                    list.id === activeListId && {
                      backgroundColor: isBlack ? '#1E293B' : '#E2E8F0',
                    },
                    { borderBottomColor: colors.cardBorder },
                  ]}
                  onPress={() => {
                    onSwitchList(list.id);
                    setIsDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownItemLeft}>
                    <Text style={styles.dropdownItemIcon}>{list.icon || '📋'}</Text>
                    <View>
                      <View style={styles.dropdownItemNameRow}>
                        <Text style={[styles.dropdownItemName, { color: colors.text }]} numberOfLines={1}>
                          {list.name}
                        </Text>
                        {list.id === defaultListId && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.dropdownItemCount, { color: colors.textMuted }]}>
                        {list.symbols.length} simboluri
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dropdownItemActions}>
                    {list.id !== defaultListId && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          onSetDefault(list.id);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        accessibilityLabel="Setează ca implicit"
                      >
                        <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>📌</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        openEditModal(list);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      accessibilityLabel="Editează watchlist"
                    >
                      <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>✏️</Text>
                    </TouchableOpacity>
                    {allLists.length > 1 && list.id !== defaultListId && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteList(list.id);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        accessibilityLabel="Șterge watchlist"
                      >
                        <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Create new list button */}
            <TouchableOpacity
              style={[styles.createBtn, { borderTopColor: colors.cardBorder }]}
              onPress={() => {
                setIsDropdownOpen(false);
                setNewListName('');
                setNewListIcon('⭐');
                setNewListColor('#3B82F6');
                setIsCreateModalOpen(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.createBtnIcon}>➕</Text>
              <Text style={[styles.createBtnText, { color: '#3B82F6' }]}>Creează listă nouă</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Create List Modal */}
      <Modal visible={isCreateModalOpen} transparent animationType="fade" onRequestClose={() => setIsCreateModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isBlack ? '#0F172A' : '#FFFFFF', borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Creează listă nouă</Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Nume</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: isBlack ? '#1E293B' : '#F8FAFC' }]}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="ex: Tech Stocks"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Iconiță</Text>
            <View style={styles.iconGrid}>
              {LIST_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    icon === newListIcon && { backgroundColor: '#3B82F620', borderColor: '#3B82F6' },
                    { borderColor: colors.cardBorder },
                  ]}
                  onPress={() => setNewListIcon(icon)}
                >
                  <Text style={styles.iconOptionText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Culoare</Text>
            <View style={styles.colorGrid}>
              {LIST_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    color === newListColor && styles.colorOptionSelected,
                  ]}
                  onPress={() => setNewListColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.cardBorder }]}
                onPress={() => setIsCreateModalOpen(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { opacity: newListName.trim() ? 1 : 0.4 }]}
                onPress={handleCreateList}
                disabled={!newListName.trim() || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Creează</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit List Modal */}
      <Modal visible={isEditModalOpen} transparent animationType="fade" onRequestClose={() => setIsEditModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isBlack ? '#0F172A' : '#FFFFFF', borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editează lista</Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Nume</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: isBlack ? '#1E293B' : '#F8FAFC' }]}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="Nume lista"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Iconiță</Text>
            <View style={styles.iconGrid}>
              {LIST_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    icon === newListIcon && { backgroundColor: '#3B82F620', borderColor: '#3B82F6' },
                    { borderColor: colors.cardBorder },
                  ]}
                  onPress={() => setNewListIcon(icon)}
                >
                  <Text style={styles.iconOptionText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Culoare</Text>
            <View style={styles.colorGrid}>
              {LIST_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    color === newListColor && styles.colorOptionSelected,
                  ]}
                  onPress={() => setNewListColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.cardBorder }]}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Anulează</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { opacity: newListName.trim() ? 1 : 0.4 }]}
                onPress={handleEditList}
                disabled={!newListName.trim() || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Salvează</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  activeIcon: {
    fontSize: 12,
  },
  activeName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    maxWidth: 120,
  },
  activeCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 8,
    marginLeft: 2,
  },
  savingIndicator: {
    marginLeft: 4,
  },
  dropdownModalContent: {
    width: '90%',
    maxWidth: 340,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
    maxHeight: 400,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownCloseBtn: {
    padding: 4,
  },
  dropdownCloseText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownScroll: {
    maxHeight: 280,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dropdownItemIcon: {
    fontSize: 16,
  },
  dropdownItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dropdownItemName: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 100,
  },
  defaultBadge: {
    backgroundColor: '#3B82F620',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  defaultBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  dropdownItemCount: {
    fontSize: 10,
    marginTop: 1,
  },
  dropdownItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionBtn: {
    padding: 3,
  },
  actionBtnText: {
    fontSize: 12,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  createBtnIcon: {
    fontSize: 12,
  },
  createBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  iconOption: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionText: {
    fontSize: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
