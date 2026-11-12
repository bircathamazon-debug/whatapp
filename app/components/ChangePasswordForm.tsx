import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { changeMyPassword } from '../lib/billing';
import { useTheme, type ThemeColors, RADIUS, cardShadow, PRESSED_SCALE } from '../lib/theme';
import { useT } from '../lib/i18n';

/** Formulario de cambio de contraseña (pantalla de Ajustes y primera entrada). */
export default function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { colors, mode } = useTheme();
  const t = useT();
  const styles = makeStyles(colors, mode);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = current.length > 0 && next.length >= 8 && repeat.length >= 8;

  const save = async () => {
    if (next !== repeat) return Alert.alert(t.billing.passwordsDontMatch);
    setBusy(true);
    try {
      await changeMyPassword(current, next);
      setCurrent(''); setNext(''); setRepeat('');
      Alert.alert(t.billing.passwordChanged);
      onDone?.();
    } catch (err: any) {
      const wrong = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(err?.code);
      Alert.alert(wrong ? t.billing.wrongPassword : t.billing.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      {([['current', current, setCurrent], ['newPassword', next, setNext], ['repeatPassword', repeat, setRepeat]] as const).map(([k, v, set]) => (
        <TextInput
          key={k}
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          value={v}
          onChangeText={set}
          placeholder={k === 'current' ? t.billing.currentPassword : t.billing[k]}
          placeholderTextColor={colors.textMuted}
        />
      ))}
      <Pressable disabled={!valid || busy} style={({ pressed }) => [styles.btn, (!valid || busy) && { opacity: 0.5 }, pressed && PRESSED_SCALE]} onPress={save}>
        <Text style={styles.btnText}>{t.billing.save}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    card: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 16, width: '100%', ...cardShadow(mode, 'sm') },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.md, padding: 12, color: colors.text, marginBottom: 10, fontSize: 15 },
    btn: { backgroundColor: colors.accent, borderRadius: RADIUS.pill, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
}
