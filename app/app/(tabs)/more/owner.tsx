import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import {
  getBillingStatus, ownerUpdateBilling, ownerCreateBarbershop, getAccountNotes, saveAccountNotes,
  getOpenChangeRequests, resolveChangeRequest, type BillingStatus,
} from '../../../lib/billing';
import { useTheme, type ThemeColors, RADIUS, cardShadow, PRESSED_SCALE } from '../../../lib/theme';
import { useT, useDateLocale } from '../../../lib/i18n';
import type { Branch, ChangeRequest } from '../../../../shared/types';

/**
 * Panel del dueño del sistema (solo super administrador): sus barberías
 * clientes, con plan, estado de pago, uso del mes, notas privadas, pedidos de
 * cambio y botones para bloquear / desbloquear / extender el mes gratis, y
 * el alta de una barbería nueva con su mail y contraseña.
 */
export default function OwnerScreen() {
  const { branches, isSuperAdmin, reload } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const locale = useDateLocale();
  const styles = makeStyles(colors, mode);
  const [statuses, setStatuses] = useState<Record<string, BillingStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const st: Record<string, BillingStatus> = {};
    const nt: Record<string, string> = {};
    await Promise.all(
      branches.map(async (b) => {
        st[b.id] = await getBillingStatus(b.id).catch(() => undefined as any);
        nt[b.id] = await getAccountNotes(b.id).catch(() => '');
      })
    );
    setStatuses(st);
    setNotes(nt);
    setRequests(await getOpenChangeRequests().catch(() => []));
  }, [branches]);

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin, load]);

  if (!isSuperAdmin) return <View style={styles.container} />;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
      await load();
    } catch (err: any) {
      Alert.alert(t.billing.error, err?.message ?? '');
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (b: Branch, s?: BillingStatus) => {
    if (!b.billing) return { text: t.billing.statusNoPlan, color: colors.textMuted };
    if (s?.blocked) return { text: t.billing.statusBlocked, color: colors.danger };
    if (s?.subscriptionStatus === 'past_due') return { text: t.billing.statusPastDue, color: colors.statusPending };
    if (s?.subscriptionStatus === 'active') return { text: t.billing.statusPaying, color: colors.statusConfirmed };
    return { text: t.billing.statusTrial, color: colors.accent };
  };

  const create = () =>
    run(async () => {
      await ownerCreateBarbershop({ ...form, language: 'he' });
      Alert.alert(t.billing.created(form.email));
      setForm({ name: '', email: '', password: '', phone: '' });
    });

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {busy && <ActivityIndicator color={colors.accent} style={{ marginBottom: 8 }} />}

      {requests.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.section}>{t.billing.openRequests(requests.length)}</Text>
          {requests.map((r) => (
            <View key={r.id} style={styles.request}>
              <Text style={styles.bold}>{branchName(r.branchId)}</Text>
              <Text style={styles.text}>{r.text}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.billing.reply}
                placeholderTextColor={colors.textMuted}
                value={replies[r.id] ?? ''}
                onChangeText={(v) => setReplies((x) => ({ ...x, [r.id]: v }))}
              />
              <Pressable style={({ pressed }) => [styles.smallBtn, pressed && PRESSED_SCALE]} onPress={() => run(() => resolveChangeRequest(r.id, replies[r.id] ?? ''))}>
                <Text style={styles.smallBtnText}>{t.billing.markDone}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {branches.map((b) => {
        const s = statuses[b.id];
        const st = statusLabel(b, s);
        return (
          <View key={b.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{b.name}</Text>
              <Text style={[styles.badge, { color: st.color }]}>{st.text}</Text>
            </View>
            {b.phone ? <Text style={styles.muted}>📞 {b.phone}</Text> : null}
            {s && (
              <>
                <Text style={styles.muted}>
                  {(s.plan === 'pro' ? t.billing.pro : t.billing.basic)} · {t.billing.usage(s.used, s.limit)}
                </Text>
                {s.trialEndsAt && s.subscriptionStatus !== 'active' ? (
                  <Text style={styles.muted}>{new Date(s.trialEndsAt).toLocaleDateString(locale)}</Text>
                ) : null}
              </>
            )}
            {b.billing && (
              <View style={styles.actions}>
                <Pressable style={({ pressed }) => [styles.smallBtn, pressed && PRESSED_SCALE]} onPress={() => run(() => ownerUpdateBilling(b.id, { blocked: !s?.blocked }))}>
                  <Text style={styles.smallBtnText}>{s?.blocked ? t.billing.unblock : t.billing.block}</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.smallBtn, pressed && PRESSED_SCALE]} onPress={() => run(() => ownerUpdateBilling(b.id, { extendTrialDays: 30 }))}>
                  <Text style={styles.smallBtnText}>{t.billing.extendTrial}</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.smallBtn, pressed && PRESSED_SCALE]} onPress={() => run(() => ownerUpdateBilling(b.id, { plan: s?.plan === 'pro' ? 'basic' : 'pro' }))}>
                  <Text style={styles.smallBtnText}>{s?.plan === 'pro' ? t.billing.basic : t.billing.pro}</Text>
                </Pressable>
              </View>
            )}
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              multiline
              placeholder={t.billing.notes}
              placeholderTextColor={colors.textMuted}
              value={notes[b.id] ?? ''}
              onChangeText={(v) => setNotes((x) => ({ ...x, [b.id]: v }))}
            />
            <Pressable style={({ pressed }) => [styles.smallBtn, pressed && PRESSED_SCALE]} onPress={() => run(() => saveAccountNotes(b.id, notes[b.id] ?? ''))}>
              <Text style={styles.smallBtnText}>{t.billing.save}</Text>
            </Pressable>
          </View>
        );
      })}

      <View style={styles.card}>
        <Text style={styles.section}>{t.billing.newBarbershop}</Text>
        {(['name', 'email', 'password', 'phone'] as const).map((k) => (
          <TextInput
            key={k}
            style={styles.input}
            placeholder={t.billing[k]}
            placeholderTextColor={colors.textMuted}
            value={form[k]}
            autoCapitalize={k === 'name' ? 'words' : 'none'}
            secureTextEntry={k === 'password'}
            keyboardType={k === 'email' ? 'email-address' : k === 'phone' ? 'phone-pad' : 'default'}
            onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))}
          />
        ))}
        <Pressable
          disabled={busy || !form.name || !form.email || form.password.length < 8}
          style={({ pressed }) => [styles.btn, (!form.name || !form.email || form.password.length < 8) && { opacity: 0.5 }, pressed && PRESSED_SCALE]}
          onPress={create}
        >
          <Text style={styles.btnText}>{t.billing.create}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    card: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...cardShadow(mode, 'sm') },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 17, fontWeight: '800', color: colors.text, flex: 1 },
    badge: { fontSize: 12.5, fontWeight: '800' },
    muted: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    section: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 },
    bold: { fontWeight: '700', color: colors.text },
    text: { color: colors.text, marginTop: 4 },
    request: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.md, padding: 10, color: colors.text, marginTop: 8, fontSize: 14.5 },
    smallBtn: { backgroundColor: colors.accentSoft, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8, alignSelf: 'flex-start' },
    smallBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
    btn: { backgroundColor: colors.accent, borderRadius: RADIUS.pill, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
    btnText: { color: '#fff', fontWeight: '800' },
  });
}
