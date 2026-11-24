import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useDevice } from '../context/DeviceContext';
import { DeviceOverride } from '../services/deviceDetection';
import { getAuthHeaders } from '../services/authStorage';

export interface DeviceSessionItem {
  id: string;
  email: string;
  device_label: string | null;
  ip_address: string | null;
  last_active_at: number; // Unix seconds
  expires_at: number;
  created_at: number;
}

const API_BASE_URL = 'https://snoti.onrender.com';

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString();
}

interface Props {
  currentUserEmail: string;
}

export default function SettingsScreen({ currentUserEmail }: Props) {
  const { colors } = useTheme();
  const {
    width,
    height,
    isLandscape,
    isAllview,
    profileLabel,
    profileIcon,
    deviceOverride,
    setDeviceOverride,
    hardware,
  } = useDevice();

  const [sessions, setSessions] = useState<DeviceSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmail, setFilterEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/admin/sessions`, {
        headers: authHeaders,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = useCallback(
    (id: string, email: string) => {
      const isSelf = email === currentUserEmail;
      Alert.alert(
        'Revoke session?',
        isSelf
          ? 'This is YOUR current session. You will be logged out.'
          : `Revoke ${email}'s session? The device will be signed out immediately.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Revoke',
            style: 'destructive',
            onPress: async () => {
              try {
                const authHeaders = await getAuthHeaders();
                const res = await fetch(`${API_BASE_URL}/api/admin/sessions/${encodeURIComponent(id)}`, {
                  method: 'DELETE',
                  headers: authHeaders,
                  credentials: 'include',
                });
                if (!res.ok) throw new Error(`Error ${res.status}`);
                setSessions((prev) => prev.filter((s) => s.id !== id));
              } catch (err: any) {
                Alert.alert('Error', err.message ?? 'Failed to revoke session');
              }
            },
          },
        ]
      );
    },
    [currentUserEmail]
  );

  const filtered = useMemo(() => {
    const q = filterEmail.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.email.toLowerCase().includes(q));
  }, [sessions, filterEmail]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: colors.navBorder,
      backgroundColor: colors.nav,
    },
    title: { fontSize: 18, fontWeight: '800', color: colors.text ?? '#fff', marginBottom: 2 },
    subtitle: { fontSize: 12, color: colors.subText ?? '#aaa' },
    // Device Profile Settings Card
    deviceCard: {
      marginHorizontal: 12,
      marginTop: 10,
      marginBottom: 6,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.nav,
      borderWidth: 1,
      borderColor: isAllview ? '#3B82F6' : colors.navBorder,
    },
    deviceCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
      flexWrap: 'wrap',
      gap: 6,
    },
    deviceCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text ?? '#fff',
    },
    deviceActivePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isAllview ? 'rgba(59, 130, 246, 0.2)' : colors.segmentActive,
      borderWidth: 1,
      borderColor: isAllview ? '#3B82F6' : colors.cardBorder,
    },
    deviceActivePillText: {
      fontSize: 11,
      fontWeight: '700',
      color: isAllview ? '#3B82F6' : colors.text,
    },
    deviceCardDesc: {
      fontSize: 11,
      color: colors.subText ?? '#aaa',
      lineHeight: 16,
      marginBottom: 8,
    },
    hardwareBox: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.segmentBackground,
      marginBottom: 10,
      gap: 3,
    },
    hwText: {
      fontSize: 10,
      color: colors.text ?? '#fff',
    },
    profileBtnRow: {
      flexDirection: 'row',
      gap: 5,
      flexWrap: 'wrap',
    },
    profileBtn: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.navBorder,
      backgroundColor: colors.segmentBackground,
    },
    profileBtnActive: {
      backgroundColor: isAllview ? '#3B82F6' : colors.segmentActive,
      borderColor: '#3B82F6',
    },
    profileBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.subText ?? '#aaa',
    },
    profileBtnTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    // Toolbar & Sessions
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    },
    input: {
      flex: 1,
      height: 34,
      borderWidth: 1,
      borderColor: colors.navBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      color: colors.text ?? '#fff',
      backgroundColor: colors.segmentBackground,
      fontSize: 12,
    },
    refreshBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.segmentActive,
    },
    refreshBtnText: { fontSize: 12, fontWeight: '600', color: colors.segmentTextActive },
    card: {
      marginHorizontal: 12,
      marginVertical: 4,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.nav,
      borderWidth: 1,
      borderColor: colors.navBorder,
    },
    emailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    emailText: { fontSize: 13, fontWeight: '700', color: colors.text ?? '#fff', flex: 1 },
    revokeBtn: {
      backgroundColor: '#ff3b3b22',
      borderRadius: 6,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: '#ff3b3b88',
    },
    revokeBtnText: { fontSize: 11, fontWeight: '600', color: '#ff3b3b' },
    metaRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    chip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.segmentBackground,
    },
    chipText: { fontSize: 10, color: colors.subText ?? '#aaa' },
    selfBadge: {
      backgroundColor: '#3b82f622',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
      marginLeft: 6,
      borderWidth: 1,
      borderColor: '#3b82f688',
    },
    selfBadgeText: { fontSize: 10, fontWeight: '600', color: '#3b82f6' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyText: { color: colors.subText ?? '#aaa', fontSize: 13 },
    errorBanner: {
      margin: 12,
      padding: 10,
      backgroundColor: '#ff3b3b22',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#ff3b3b88',
    },
    errorText: { color: '#ff3b3b', fontSize: 12 },
  });

  const renderItem = ({ item }: { item: DeviceSessionItem }) => {
    const isSelf = item.email === currentUserEmail;
    return (
      <View style={styles.card}>
        <View style={styles.emailRow}>
          <Text style={styles.emailText} numberOfLines={1}>
            {item.email}
          </Text>
          {isSelf && (
            <View style={styles.selfBadge}>
              <Text style={styles.selfBadgeText}>YOU</Text>
            </View>
          )}
          <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(item.id, item.email)}>
            <Text style={styles.revokeBtnText}>Revoke</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>📱 {item.device_label ?? 'Unknown Device'}</Text>
          </View>
          {item.ip_address && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>🌐 {item.ip_address}</Text>
            </View>
          )}
          <View style={styles.chip}>
            <Text style={styles.chipText}>⏱ Activ: {formatDate(item.last_active_at)}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>⌛ Expiră: {formatDate(item.expires_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Setări Sistem & Dispozitiv</Text>
        <Text style={styles.subtitle}>Sesiuni active de dispozitive — {sessions.length} total</Text>
      </View>

      {/* ── Device Profile & Adaptation Card ── */}
      <View style={styles.deviceCard}>
        <View style={styles.deviceCardHeader}>
          <Text style={styles.deviceCardTitle}>Adaptivitate Dispozitiv</Text>
          <View style={styles.deviceActivePill}>
            <Text style={styles.deviceActivePillText}>
              {profileIcon} {profileLabel} {deviceOverride !== 'auto' ? '(Forțat)' : '(Detectat Auto)'}
            </Text>
          </View>
        </View>

        <Text style={styles.deviceCardDesc}>
          Aplicația adaptează automat layout-ul între modul Kiosk 2 coloane pentru tablete Allview și modul responsiv pentru telefoane mobile și alte dispozitive.
        </Text>

        <View style={styles.hardwareBox}>
          <Text style={styles.hwText}>
            • Hardware: {hardware.brand || 'Nespecificat'} {hardware.modelName ? `(${hardware.modelName})` : ''} {hardware.manufacturer ? `produs de ${hardware.manufacturer}` : ''}
          </Text>
          <Text style={styles.hwText}>
            • Rezoluție: {Math.round(width)} × {Math.round(height)} px ({isLandscape ? 'Landscape' : 'Portrait'})
          </Text>
          <Text style={styles.hwText}>
            • Detectat ca Allview: {hardware.isAllviewHardware ? 'DA ✅ (Hardware Allview / Visual Fan)' : 'NU (Dispozitiv standard) 📱'}
          </Text>
        </View>

        <View style={styles.profileBtnRow}>
          {(['auto', 'allview', 'phone', 'tablet', 'desktop'] as DeviceOverride[]).map((mode) => {
            const isSelected = deviceOverride === mode;
            const label =
              mode === 'auto'
                ? '⚡ Auto'
                : mode === 'allview'
                ? '📟 Allview'
                : mode === 'phone'
                ? '📱 Telefon'
                : mode === 'tablet'
                ? '📋 Tabletă'
                : '💻 Desktop';

            return (
              <TouchableOpacity
                key={mode}
                style={[styles.profileBtn, isSelected && styles.profileBtnActive]}
                onPress={() => setDeviceOverride(mode)}
                activeOpacity={0.7}
              >
                <Text style={[styles.profileBtnText, isSelected && styles.profileBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      <View style={styles.toolbar}>
        <TextInput
          style={styles.input}
          placeholder="Filtrează după email…"
          placeholderTextColor={colors.subText ?? '#888'}
          value={filterEmail}
          onChangeText={setFilterEmail}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {filterEmail.length > 0 && (
          <TouchableOpacity onPress={() => setFilterEmail('')}>
            <Text style={{ color: '#3b82f6', fontSize: 13 }}>Șterge</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchSessions}>
          <Text style={styles.refreshBtnText}>Reîmprospătează</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nu s-au găsit sesiuni active.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}
