import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, TextInput, Alert } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { getChangeRequests, createChangeRequest } from '../../../lib/billing';
import { useTheme, type ThemeColors, RADIUS, cardShadow, PRESSED_SCALE } from '../../../lib/theme';
import { useT, useDateLocale } from '../../../lib/i18n';
import type { ChangeRequest } from '../../../../shared/types';

/** "Pedidos de cambio": la barbería le escribe al dueño del sistema qué
 * quiere cambiar en su app (tipos de corte, peluqueros del menú, etc.) y ve
 * la respuesta cuando está hecho. */
export default function RequestsScreen() {
  const { branchId, readOnly } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const locale = useDateLocale();
  const styles = makeStyles(colors, mode);
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setItems(await getChangeRequests(branchId).catch(() => []));
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!branchId || !text.trim() || readOnly) return;
    setBusy(true);
    try {
      await createChangeRequest(branchId, text);
      setText('');
      Alert.alert(t.billing.sent);
      await load();
    } catch {
      Alert.alert(t.billing.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={items}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            multiline
            maxLength={2000}
            value={text}
            onChangeText={setText}
            placeholder={t.billing.requestPlaceholder}
            placeholderTextColor={colors.textMuted}
            editable={!readOnly}
          />
          <Pressable disabled={busy || !text.trim() || readOnly} style={({ pressed }) => [styles.btn, (!text.trim() || busy) && { opacity: 0.5 }, pressed && PRESSED_SCALE]} onPress={send}>
            <Text style={styles.btnText}>{t.billing.send}</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={<Text style={styles.muted}>{t.billing.noRequests}</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString(locale)}</Text>
            <Text style={[styles.badge, { color: item.status === 'done' ? colors.statusConfirmed : colors.statusPending }]}>
              {item.status === 'done' ? t.billing.done : t.billing.open}
            </Text>
          </View>
          <Text style={styles.text}>{item.text}</Text>
          {item.reply ? <Text style={styles.reply}>{t.billing.reply}: {item.reply}</Text> : null}
        </View>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    card: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...cardShadow(mode, 'sm') },
    input: { minHeight: 90, backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.md, padding: 12, color: colors.text, textAlignVertical: 'top', fontSize: 15 },
    btn: { backgroundColor: colors.accent, borderRadius: RADIUS.pill, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
    btnText: { color: '#fff', fontWeight: '800' },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    date: { fontSize: 12, color: colors.textMuted },
    badge: { fontSize: 12, fontWeight: '700' },
    text: { fontSize: 15, color: colors.text, marginTop: 6 },
    reply: { fontSize: 14, color: colors.accent, marginTop: 8, fontWeight: '600' },
    muted: { color: colors.textMuted, textAlign: 'center', marginTop: 20 },
  });
}
