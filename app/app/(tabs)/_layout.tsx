import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useTheme } from '../../lib/theme';
import { useT } from '../../lib/i18n';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, nameFocused, color, focused }: { name: IconName; nameFocused: IconName; color: string; focused: boolean }) {
  return <Ionicons name={focused ? nameFocused : name} size={24} color={color} />;
}

export default function TabsLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const { colors, mode } = useTheme();
  const t = useT();

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
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: 66,
          paddingTop: 8,
          paddingBottom: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: mode === 'dark' ? 0.3 : 0.06,
          shadowRadius: 10,
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 19 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.agenda,
          tabBarLabel: t.tabs.agenda,
          tabBarIcon: ({ color, focused }) => <TabIcon name="calendar-outline" nameFocused="calendar" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="waitlist"
        options={{
          title: t.tabs.waitlist,
          tabBarLabel: t.tabs.waitlistShort,
          tabBarIcon: ({ color, focused }) => <TabIcon name="time-outline" nameFocused="time" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: t.tabs.clients,
          tabBarLabel: t.tabs.clients,
          tabBarIcon: ({ color, focused }) => <TabIcon name="people-outline" nameFocused="people" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: t.tabs.campaigns,
          tabBarLabel: t.tabs.campaigns,
          tabBarIcon: ({ color, focused }) => <TabIcon name="megaphone-outline" nameFocused="megaphone" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="questions"
        options={{
          title: t.tabs.questions,
          tabBarLabel: t.tabs.questions,
          tabBarIcon: ({ color, focused }) => <TabIcon name="help-circle-outline" nameFocused="help-circle" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
