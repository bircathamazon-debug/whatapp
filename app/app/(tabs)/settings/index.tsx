import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, type ThemeColors, RADIUS, cardShadow } from '../../../lib/theme';
import { useT } from '../../../lib/i18n';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function SettingsMenuScreen() {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const t = useT();
  const styles = makeStyles(colors, mode);

  const MENU: { icon: IconName; label: string; route: '/settings/branches' | '/settings/staff' | '/settings/services' | '/settings/schedule' | '/settings/general' }[] = [
    { icon: 'business', label: t.adminMenu.branches, route: '/settings/branches' },
    { icon: 'cut', label: t.adminMenu.staff, route: '/settings/staff' },
    { icon: 'sparkles', label: t.adminMenu.services, route: '/settings/services' },
    { icon: 'calendar', label: t.adminMenu.schedule, route: '/settings/schedule' },
    { icon: 'settings', label: t.adminMenu.settings, route: '/settings/general' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18, paddingBottom: 32 }}>
      <Text style={styles.title}>{t.settings.title}</Text>

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
    menuText: { fontSize: 15.5, color: colors.text, fontWeight: '600', flex: 1 },
    chevron: { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] },
  });
}
