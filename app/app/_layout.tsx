import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BranchProvider } from '../lib/branchContext';
import { useTheme } from '../lib/theme';
import { useLang, isRtl } from '../lib/i18n';

// Por defecto arranca en RTL (hebreo, el mercado actual) hasta que se sepa
// el idioma real de la sucursal — eso requiere haber iniciado sesión y
// leído Firestore, así que no se puede saber antes del primer render.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

function ThemedStack() {
  const { mode, colors } = useTheme();
  const lang = useLang();

  // Si la sucursal termina usando un idioma con otra dirección de escritura
  // (ej. inglés/español, LTR, contra el RTL con el que arrancó la app), se
  // deja preparado para la próxima vez que se abra — no se puede dar vuelta
  // el layout en caliente, es una limitación de React Native.
  useEffect(() => {
    if (isRtl(lang) !== I18nManager.isRTL) {
      I18nManager.forceRTL(isRtl(lang));
    }
  }, [lang]);

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
