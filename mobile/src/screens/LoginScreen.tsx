import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const API_BASE_URL = 'https://snoti.onrender.com';

export default function LoginScreen() {
  const { colors } = useTheme();

  const handleSignIn = () => {
    // On web this opens the Google OAuth redirect in the same tab.
    // On native (Expo), Linking.openURL opens the browser.
    if (typeof window !== 'undefined') {
      window.location.href = `${API_BASE_URL}/api/auth/google`;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.nav,
      borderRadius: 20,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.navBorder,
    },
    logo: { fontSize: 44, marginBottom: 12 },
    title: { fontSize: 26, fontWeight: '800', color: colors.text ?? '#fff', marginBottom: 6 },
    subtitle: { fontSize: 14, color: colors.subText ?? '#aaa', textAlign: 'center', marginBottom: 28 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#4285F4',
      borderRadius: 10,
      paddingVertical: 13,
      paddingHorizontal: 24,
      gap: 10,
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    note: { marginTop: 20, fontSize: 11, color: colors.subText ?? '#888', textAlign: 'center' },
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>📊</Text>
        <Text style={styles.title}>Snotih</Text>
        <Text style={styles.subtitle}>
          Currency & market monitor.{'\n'}Sign in with an authorized Google account.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={handleSignIn} activeOpacity={0.85}>
          <Text style={{ fontSize: 18 }}>G</Text>
          <Text style={styles.btnText}>Sign in with Google</Text>
        </TouchableOpacity>
        <Text style={styles.note}>Access is restricted to invited users only.</Text>
      </View>
    </View>
  );
}
