import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useTheme } from '../../lib/theme';

export default function TabsLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(!!user);
      setChecking(false);
      if (!user) router.replace('/admin/login');
    });
    return unsub;
  }, []);

  if (checking || !authed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'יומן',
          tabBarLabel: 'יומן',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="waitlist"
        options={{
          title: 'רשימת המתנה',
          tabBarLabel: 'המתנה',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>⏳</Text>,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'לקוחות',
          tabBarLabel: 'לקוחות',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'קמפיינים',
          tabBarLabel: 'קמפיינים',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📣</Text>,
        }}
      />
    </Tabs>
  );
}
