import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { getBillingStatus, setBillingPlan, type BillingStatus } from '../../../lib/billing';
import { createTranzilaCheckoutUrl } from '../../../lib/tranzila';
import { useTheme, type ThemeColors, RADIUS, cardShadow, accentGlow, PRESSED_SCALE } from '../../../lib/theme';
import { useT, useDateLocale } from '../../../lib/i18n';

/** "Mi plan": la barbería ve su plan, cuánto usó este mes, el mes gratis, y
 * puede cambiar de plan o cargar la tarjeta para el cobro automático. */
export default function PlanScreen() {
  const { branchId, readOnly } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const locale = useDateLocale();
  const styles = makeStyles(colors, mode);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      setStatus(await getBillingStatus(branchId));
    } catch {
      Alert.alert(t.billing.error);
    }
  }, [branchId, t]);

  useEffect(() => { load(); }, [load]);

  const choose = async (plan: 'basic' | 'pro') => {
    if (!branchId || readOnly) return;
    setBusy(true);
    try {
      await setBillingPlan(branchId, plan);
      Alert.alert(t.billing.planChanged);
      await load();
    } catch {
      Alert.alert(t.billing.error);
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!branchId || readOnly) return;
    setBusy(true);
    try {
      await Linking.openURL(await createTranzilaCheckoutUrl(branchId));
    } catch (err: any) {
      Alert.alert(err?.code === 'functions/failed-precondition' ? t.billing.paymentsNotReady : t.billing.error);
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  }

  const daysLeft = status.trialEndsAt ? Math.ceil((status.trialEndsAt - Date.now()) / 86400000) : null;
  const paying = status.subscriptionStatus === 'active';
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(locale);

  const planCard = (plan: 'basic' | 'pro') => {
    const selected = status.plan === plan;
    return (
      <View key={plan} style={[styles.card, selected && styles.cardSelected]}>
        <Text style={styles.planName}>{plan === 'basic' ? t.billing.basic : t.billing.pro}</Text>
        <Text style={styles.price}>{t.billing.perMonth(status.prices[plan])}</Text>
        <Text style={styles.muted}>{plan === 'basic' ? t.billing.basicDesc(status.basicLimit ?? 0) : t.billing.proDesc}</Text>
        {selected ? (
          <Text style={styles.currentTag}>{t.billing.current}</Text>
        ) : (
          <Pressable disabled={busy || readOnly} style={({ pressed }) => [styles.secondaryBtn, pressed && PRESSED_SCALE]} onPress={() => choose(plan)}>
            <Text style={styles.secondaryBtnText}>{t.billing.choose}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.card}>
        <Text style={styles.usage}>{t.billing.usage(status.used, status.limit)}</Text>
        {!paying && daysLeft !== null && (
          <Text style={styles.muted}>{daysLeft > 0 ? t.billing.trialLeft(daysLeft) : t.billing.trialOver}</Text>
        )}
        {paying && status.nextChargeAt && <Text style={styles.muted}>{t.billing.nextCharge(fmt(status.nextChargeAt))}</Text>}
      </View>

      {planCard('basic')}
      {planCard('pro')}

      {paying ? (
        <Text style={styles.ok}>{t.billing.cardActive}</Text>
      ) : (
        <Pressable disabled={busy || readOnly} style={({ pressed }) => [styles.primaryBtn, pressed && PRESSED_SCALE]} onPress={pay}>
          <Text style={styles.primaryBtnText}>{t.billing.payWithCard}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
    card: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: 'transparent', ...cardShadow(mode, 'sm') },
    cardSelected: { borderColor: colors.accent },
    usage: { fontSize: 16, fontWeight: '700', color: colors.text },
    planName: { fontSize: 18, fontWeight: '800', color: colors.text },
    price: { fontSize: 22, fontWeight: '800', color: colors.accent, marginVertical: 4 },
    muted: { fontSize: 13.5, color: colors.textMuted, marginTop: 4 },
    currentTag: { marginTop: 10, color: colors.accent, fontWeight: '700' },
    ok: { textAlign: 'center', color: colors.statusConfirmed, fontWeight: '700', marginTop: 8 },
    primaryBtn: { backgroundColor: colors.accent, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center', marginTop: 8, ...accentGlow(colors, mode) },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15.5 },
    secondaryBtn: { backgroundColor: colors.accentSoft, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
    secondaryBtnText: { color: colors.accent, fontWeight: '700' },
  });
}
