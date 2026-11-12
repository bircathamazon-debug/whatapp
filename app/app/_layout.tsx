import { useEffect } from 'react';
import { I18nManager, Platform, View, Text, Pressable, Linking, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BranchProvider, useBranch } from '../lib/branchContext';
import { useTheme, WEB_SHELL_MAX_WIDTH } from '../lib/theme';
import { useLang, isRtl, useT } from '../lib/i18n';
import { createTranzilaCheckoutUrl } from '../lib/tranzila';

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
  const t = useT();
  const { readOnly, isSuperAdmin, branches, branchId } = useBranch();
  const currentBranch = branches.find((b) => b.id === branchId);
  const blocked = !isSuperAdmin && currentBranch?.billing?.blocked === true;

  // Si la sucursal termina usando un idioma con otra dirección de escritura
  // (ej. inglés/español, LTR, contra el RTL con el que arrancó la app), se
  // deja preparado para la próxima vez que se abra — no se puede dar vuelta
  // el layout en caliente, es una limitación de React Native.
  useEffect(() => {
    if (isRtl(lang) !== I18nManager.isRTL) {
      I18nManager.forceRTL(isRtl(lang));
    }
  }, [lang]);

  const stack = (
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
  );

  // Barbería con la cuenta en pausa (falta de pago o bloqueo del dueño): en
  // vez del panel ve un aviso y el botón para cargar la tarjeta. El dueño del
  // sistema (super administrador) nunca queda bloqueado.
  const pay = async () => {
    if (!branchId) return;
    try {
      await Linking.openURL(await createTranzilaCheckoutUrl(branchId));
    } catch (err: any) {
      Alert.alert(err?.code === 'functions/failed-precondition' ? t.billing.paymentsNotReady : t.billing.error);
    }
  };
  const blockedView = blocked ? (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 44 }}>⏸️</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 10, textAlign: 'center' }}>{t.billing.blockedTitle}</Text>
      <Text style={{ fontSize: 15, color: colors.textMuted, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
        {currentBranch?.billing?.blockedReason === 'manual' ? t.billing.blockedManual : t.billing.blockedText}
      </Text>
      {currentBranch?.billing?.blockedReason !== 'manual' && (
        <Pressable onPress={pay} style={{ backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28, marginTop: 22 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15.5 }}>{t.billing.payWithCard}</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  const banner = readOnly ? (
    <View style={{ backgroundColor: colors.statusPending, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{t.readOnlyBanner}</Text>
    </View>
  ) : null;

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      {banner}
      {Platform.OS === 'web' ? (
        // En pantallas anchas (compu) la app se centra con proporción de
        // celular en vez de estirarse borde a borde — si no, todo se ve
        // desarmado y "de página web" (íconos chicos perdidos en cajas
        // gigantes vacías).
        <View style={{ flex: 1, minHeight: '100%' as any, backgroundColor: colors.shellBg, alignItems: 'center' }}>
          <View
            style={{
              flex: 1,
              width: '100%',
              maxWidth: WEB_SHELL_MAX_WIDTH,
              backgroundColor: colors.bg,
              shadowColor: '#000',
              shadowOpacity: mode === 'dark' ? 0.5 : 0.15,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            {blockedView ?? stack}
          </View>
        </View>
      ) : (
        blockedView ?? stack
      )}
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
