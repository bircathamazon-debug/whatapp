import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BranchProvider } from '../lib/branchContext';

export default function RootLayout() {
  return (
    <BranchProvider>
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
        <Stack.Screen name="admin/login" options={{ title: 'Acceso del personal', presentation: 'modal' }} />
        <Stack.Screen name="admin/index" options={{ title: 'Panel del peluquero' }} />
        <Stack.Screen name="admin/branches" options={{ title: 'Sucursales' }} />
        <Stack.Screen name="admin/staff" options={{ title: 'Peluqueros' }} />
        <Stack.Screen name="admin/services" options={{ title: 'Servicios' }} />
        <Stack.Screen name="admin/schedule" options={{ title: 'Horarios' }} />
        <Stack.Screen name="admin/settings" options={{ title: 'Configuración' }} />
      </Stack>
    </BranchProvider>
  );
}
