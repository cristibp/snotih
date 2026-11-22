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
  const [sessions, setSessions] = useState<DeviceSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmail, setFilterEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/admin/sessions`, {
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
                const res = await fetch(`${API_BASE_URL}/api/admin/sessions/${encodeURIComponent(id)}`, {
                  method: 'DELETE',
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
    return q ? sessions.filter((s) => s.email.toLowerCase().includes(q)) : sessions;
  }, [sessions, filterEmail]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.navBorder,
      backgroundColor: colors.nav,
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.text ?? '#fff', marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.subText ?? '#aaa' },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 8,
    },
    input: {
      flex: 1,
      height: 36,
      borderWidth: 1,
      borderColor: colors.navBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      color: colors.text ?? '#fff',
      backgroundColor: colors.segmentBackground,
      fontSize: 13,
    },
    refreshBtn: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: colors.segmentActive,
    },
    refreshBtnText: { fontSize: 12, fontWeight: '600', color: colors.segmentTextActive },
    card: {
      marginHorizontal: 12,
      marginVertical: 6,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.nav,
      borderWidth: 1,
      borderColor: colors.navBorder,
    },
    emailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    emailText: { fontSize: 14, fontWeight: '700', color: colors.text ?? '#fff', flex: 1 },
    revokeBtn: {
      backgroundColor: '#ff3b3b22',
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: '#ff3b3b88',
    },
    revokeBtnText: { fontSize: 12, fontWeight: '600', color: '#ff3b3b' },
    metaRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    chip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.segmentBackground,
    },
    chipText: { fontSize: 11, color: colors.subText ?? '#aaa' },
    selfBadge: {
      backgroundColor: '#3b82f622',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
      marginLeft: 6,
      borderWidth: 1,
      borderColor: '#3b82f688',
    },
    selfBadgeText: { fontSize: 11, fontWeight: '600', color: '#3b82f6' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyText: { color: colors.subText ?? '#aaa', fontSize: 14 },
    errorBanner: {
      margin: 12,
      padding: 12,
      backgroundColor: '#ff3b3b22',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#ff3b3b88',
    },
    errorText: { color: '#ff3b3b', fontSize: 13 },
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
            <Text style={styles.chipText}>⏱ Active: {formatDate(item.last_active_at)}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>⌛ Expires: {formatDate(item.expires_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Admin Settings</Text>
        <Text style={styles.subtitle}>Active device sessions — {sessions.length} total</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      <View style={styles.toolbar}>
        <TextInput
          style={styles.input}
          placeholder="Filter by email…"
          placeholderTextColor={colors.subText ?? '#888'}
          value={filterEmail}
          onChangeText={setFilterEmail}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {filterEmail.length > 0 && (
          <TouchableOpacity onPress={() => setFilterEmail('')}>
            <Text style={{ color: '#3b82f6', fontSize: 13 }}>Clear</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchSessions}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No active sessions found.</Text>
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
