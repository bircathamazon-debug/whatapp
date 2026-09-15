import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useTheme } from '../../lib/theme';

export default function AdminLayout() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { colors } = useTheme();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(!!user);
      setChecking(false);
      if (!user && segments[1] !== 'login') {
        router.replace('/admin/login');
      }
    });
    return unsub;
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'הפאנל שלי' }} />
      <Stack.Screen name="login" options={{ title: 'כניסת צוות' }} />
      <Stack.Screen name="branches" options={{ title: 'סניפים' }} />
      <Stack.Screen name="staff" options={{ title: 'ספרים' }} />
      <Stack.Screen name="services" options={{ title: 'שירותים' }} />
      <Stack.Screen name="schedule" options={{ title: 'שעות עבודה' }} />
      <Stack.Screen name="settings" options={{ title: 'הגדרות' }} />
    </Stack>
  );
}
