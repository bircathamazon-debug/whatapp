import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { useT } from '../../../lib/i18n';

export default function SettingsStackLayout() {
  const { colors } = useTheme();
  const t = useT();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: t.settings.title, headerShown: false }} />
      <Stack.Screen name="branches" options={{ title: t.adminMenu.branches }} />
      <Stack.Screen name="staff" options={{ title: t.adminMenu.staff }} />
      <Stack.Screen name="services" options={{ title: t.adminMenu.services }} />
      <Stack.Screen name="schedule" options={{ title: t.schedule.weeklyHours }} />
      <Stack.Screen name="general" options={{ title: t.settings.title }} />
    </Stack>
  );
}
