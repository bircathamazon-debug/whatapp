import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export default function TabsLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator color="#1a3c5e" size="large" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1a3c5e',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e2e8f0' },
        headerStyle: { backgroundColor: '#1a3c5e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Agenda',
          tabBarLabel: 'Agenda',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="waitlist"
        options={{
          title: 'Lista de espera',
          tabBarLabel: 'Espera',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>⏳</Text>,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clientes',
          tabBarLabel: 'Clientes',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Campañas',
          tabBarLabel: 'Campañas',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📣</Text>,
        }}
      />
    </Tabs>
  );
}
