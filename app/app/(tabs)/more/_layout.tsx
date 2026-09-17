import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { useT } from '../../../lib/i18n';

export default function MoreStackLayout() {
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
      <Stack.Screen name="index" options={{ title: t.tabs.more, headerShown: false }} />
      <Stack.Screen name="waitlist" options={{ title: t.tabs.waitlist }} />
      <Stack.Screen name="clients" options={{ title: t.tabs.clients }} />
      <Stack.Screen name="campaigns" options={{ title: t.tabs.campaigns }} />
      <Stack.Screen name="questions" options={{ title: t.tabs.questions }} />
    </Stack>
  );
}
