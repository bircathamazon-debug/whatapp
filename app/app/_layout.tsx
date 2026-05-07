import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Force RTL for Hebrew
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a3c5e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          contentStyle: { backgroundColor: '#f8fafc' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="contact/[id]"
          options={{ title: 'פרטי איש קשר' }}
        />
        <Stack.Screen
          name="admin/login"
          options={{ title: 'כניסת מנהל', presentation: 'modal' }}
        />
        <Stack.Screen
          name="admin/contacts"
          options={{ title: 'ניהול אנשי קשר' }}
        />
        <Stack.Screen
          name="admin/index"
          options={{ title: 'פאנל ניהול' }}
        />
      </Stack>
    </>
  );
}
