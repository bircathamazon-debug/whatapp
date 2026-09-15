import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useTheme, type ThemeColors } from '../../lib/theme';

const MENU = [
  { icon: '🏢', label: 'סניפים', route: '/admin/branches' as const },
  { icon: '💈', label: 'ספרים', route: '/admin/staff' as const },
  { icon: '💇', label: 'שירותים', route: '/admin/services' as const },
  { icon: '🗓️', label: 'שעות עבודה וימים חסומים', route: '/admin/schedule' as const },
  { icon: '⚙️', label: 'הגדרות (מקדמות, שבת, Google Calendar)', route: '/admin/settings' as const },
];

export default function AdminIndexScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const logout = async () => {
    Alert.alert('יציאה מהחשבון', 'לצאת מהחשבון?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'יציאה', style: 'destructive', onPress: async () => { await signOut(auth); router.replace('/admin/login'); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>הפאנל שלי</Text>

      {MENU.map((item) => (
        <TouchableOpacity key={item.route} style={styles.menuItem} onPress={() => router.push(item.route)}>
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuText}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout}>
        <Text style={styles.menuIcon}>🚪</Text>
        <Text style={[styles.menuText, styles.logoutText]}>יציאה מהחשבון</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
    title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20, marginTop: 8 },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 18,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
      gap: 12,
    },
    logoutItem: { backgroundColor: colors.dangerSoft },
    menuIcon: { fontSize: 22 },
    menuText: { fontSize: 15, color: colors.text, fontWeight: '600', flex: 1 },
    logoutText: { color: colors.danger },
  });
}
