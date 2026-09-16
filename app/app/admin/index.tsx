import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { useT } from '../../lib/i18n';

export default function AdminIndexScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);

  const MENU = [
    { icon: '🏢', label: t.adminMenu.branches, route: '/admin/branches' as const },
    { icon: '💈', label: t.adminMenu.staff, route: '/admin/staff' as const },
    { icon: '💇', label: t.adminMenu.services, route: '/admin/services' as const },
    { icon: '🗓️', label: t.adminMenu.schedule, route: '/admin/schedule' as const },
    { icon: '💰', label: t.adminMenu.finance, route: '/admin/finance' as const },
    { icon: '⚙️', label: t.adminMenu.settings, route: '/admin/settings' as const },
  ];

  const logout = async () => {
    Alert.alert(t.adminMenu.logoutTitle, t.adminMenu.logoutConfirm, [
      { text: t.adminMenu.cancel, style: 'cancel' },
      { text: t.adminMenu.logout, style: 'destructive', onPress: async () => { await signOut(auth); router.replace('/admin/login'); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.adminMenu.title}</Text>

      {MENU.map((item) => (
        <TouchableOpacity key={item.route} style={styles.menuItem} onPress={() => router.push(item.route)}>
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuText}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout}>
        <Text style={styles.menuIcon}>🚪</Text>
        <Text style={[styles.menuText, styles.logoutText]}>{t.adminMenu.logout}</Text>
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
