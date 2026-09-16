import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BranchProvider } from '../lib/branchContext';
import { useTheme } from '../lib/theme';

// El negocio es en Israel y todo el panel está en hebreo: fuerza RTL
// (de derecha a izquierda) para toda la app. Requiere reiniciar la app una
// vez para que tome efecto (limitación de React Native).
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

function ThemedStack() {
  const { mode, colors } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* admin/_layout.tsx ya define su propio Stack con los títulos en
            hebreo de cada pantalla; acá solo se oculta el header duplicado. */}
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <BranchProvider>
      <ThemedStack />
    </BranchProvider>
  );
}
