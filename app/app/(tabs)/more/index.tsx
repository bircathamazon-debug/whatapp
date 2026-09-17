import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { useTheme, type ThemeColors, RADIUS, cardShadow } from '../../../lib/theme';
import { useT } from '../../../lib/i18n';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function MoreMenuScreen() {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const t = useT();
  const styles = makeStyles(colors, mode);

  const MENU: { icon: IconName; label: string; route: '/more/waitlist' | '/more/clients' | '/more/campaigns' | '/more/questions' }[] = [
    { icon: 'time', label: t.tabs.waitlist, route: '/more/waitlist' },
    { icon: 'people', label: t.tabs.clients, route: '/more/clients' },
    { icon: 'megaphone', label: t.tabs.campaigns, route: '/more/campaigns' },
    { icon: 'help-circle', label: t.tabs.questions, route: '/more/questions' },
  ];

  const logout = async () => {
    Alert.alert(t.adminMenu.logoutTitle, t.adminMenu.logoutConfirm, [
      { text: t.adminMenu.cancel, style: 'cancel' },
      { text: t.adminMenu.logout, style: 'destructive', onPress: async () => { await signOut(auth); router.replace('/admin/login'); } },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18, paddingBottom: 32 }}>
      <Text style={styles.title}>{t.tabs.more}</Text>

      <View style={styles.menuCard}>
        {MENU.map((item, i) => (
          <TouchableOpacity
            key={item.route}
            style={[styles.menuItem, i < MENU.length - 1 && styles.menuItemDivider]}
            onPress={() => router.push(item.route)}
            activeOpacity={0.7}
          >
            <View style={styles.iconBadge}>
              <Ionicons name={item.icon} size={20} color={colors.accent} />
            </View>
            <Text style={styles.menuText}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutItem} onPress={logout} activeOpacity={0.7}>
        <View style={[styles.iconBadge, styles.iconBadgeDanger]}>
          <Ionicons name="log-out" size={20} color={colors.danger} />
        </View>
        <Text style={[styles.menuText, styles.logoutText]}>{t.adminMenu.logout}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 18, marginTop: 4, letterSpacing: -0.3 },
    menuCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      ...cardShadow(mode, 'md'),
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 14,
    },
    menuItemDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    iconBadge: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBadgeDanger: { backgroundColor: colors.dangerSoft },
    menuText: { fontSize: 15.5, color: colors.text, fontWeight: '600', flex: 1 },
    chevron: { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] },
    logoutItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginTop: 16,
      gap: 14,
      ...cardShadow(mode, 'sm'),
    },
    logoutText: { color: colors.danger },
  });
}
