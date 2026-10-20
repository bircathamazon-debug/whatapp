import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { broadcastEmptySlots, broadcastWeekdayDiscount } from '../../../lib/campaigns';
import { updateBranch } from '../../../lib/branches';
import { useTheme, type ThemeColors, RADIUS, cardShadow, accentBorder, accentGlow, PRESSED_SCALE } from '../../../lib/theme';
import { useT } from '../../../lib/i18n';

const DEFAULT_WEEKDAYS = [0, 1]; // domingo y lunes
const DEFAULT_PERCENT = 10;

export default function CampaignsScreen() {
  const { branchId, branches } = useBranch();
  const branch = branches.find((b) => b.id === branchId);
  const { colors, mode } = useTheme();
  const t = useT();
  const styles = makeStyles(colors, mode);

  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>(DEFAULT_WEEKDAYS);
  const [percent, setPercent] = useState(String(DEFAULT_PERCENT));
  const [saving, setSaving] = useState(false);
  const [sendingDiscount, setSendingDiscount] = useState(false);
  const [discountResult, setDiscountResult] = useState<string | null>(null);

  useEffect(() => {
    const d = branch?.weekdayDiscount;
    if (d) {
      setEnabled(d.enabled);
      setSelectedDays(d.weekdays);
      setPercent(String(d.percent));
    }
  }, [branch?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!branchId) return;
    setSending(true);
    try {
      const { sentTo, message } = await broadcastEmptySlots(branchId);
      setLastResult(sentTo > 0 ? t.campaigns.sentTo(sentTo, message) : message);
    } catch (err: any) {
      Alert.alert(t.campaigns.error, err.message ?? t.campaigns.errorGeneric);
    } finally {
      setSending(false);
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));
  };

  const saveDiscount = async () => {
    if (!branchId) return;
    const percentNum = Number(percent);
    if (!percentNum || percentNum <= 0 || percentNum > 100 || selectedDays.length === 0) return;
    setSaving(true);
    try {
      await updateBranch(branchId, { weekdayDiscount: { enabled, weekdays: selectedDays, percent: percentNum } });
      setDiscountResult(t.campaigns.discountSaved);
    } finally {
      setSaving(false);
    }
  };

  const sendDiscountPromo = async () => {
    if (!branchId) return;
    setSendingDiscount(true);
    try {
      const { sentTo, message } = await broadcastWeekdayDiscount(branchId);
      setDiscountResult(t.campaigns.sentTo(sentTo, message));
    } catch (err: any) {
      const text = err?.code === 'functions/failed-precondition' ? t.campaigns.discountDisabledError : (err.message ?? t.campaigns.errorGeneric);
      Alert.alert(t.campaigns.error, text);
    } finally {
      setSendingDiscount(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>{t.campaigns.title}</Text>
      <Text style={styles.subtitle}>{t.campaigns.subtitle}</Text>
      <Pressable style={({ pressed }) => [styles.btn, pressed && PRESSED_SCALE]} onPress={send} disabled={sending || !branchId}>
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.campaigns.send}</Text>}
      </Pressable>
      {lastResult && <Text style={styles.result}>{lastResult}</Text>}

      <View style={styles.divider} />

      <Text style={styles.title}>{t.campaigns.discountTitle}</Text>
      <Text style={styles.subtitle}>{t.campaigns.discountHint}</Text>

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <Text style={styles.fieldLabel}>{t.campaigns.discountEnableLabel}</Text>
          <Pressable style={({ pressed }) => [styles.togglePill, enabled && styles.togglePillActive, pressed && PRESSED_SCALE]} onPress={() => setEnabled((v) => !v)}>
            <Text style={[styles.togglePillText, enabled && styles.togglePillTextActive]}>{enabled ? 'ON' : 'OFF'}</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>{t.campaigns.discountDaysLabel}</Text>
        <View style={styles.chipsRow}>
          {t.schedule.weekdays.map((name, i) => (
            <Pressable key={i} style={({ pressed }) => [styles.chip, selectedDays.includes(i) && styles.chipActive, pressed && PRESSED_SCALE]} onPress={() => toggleDay(i)}>
              <Text style={[styles.chipText, selectedDays.includes(i) && styles.chipTextActive]}>{name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>{t.campaigns.discountPercentLabel}</Text>
        <TextInput style={styles.input} value={percent} onChangeText={setPercent} keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.textMuted} />

        <Pressable style={({ pressed }) => [styles.saveBtn, pressed && PRESSED_SCALE]} onPress={saveDiscount} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t.campaigns.discountSave}</Text>}
        </Pressable>
      </View>

      <Pressable style={({ pressed }) => [styles.btn, pressed && PRESSED_SCALE]} onPress={sendDiscountPromo} disabled={sendingDiscount || !branchId}>
        {sendingDiscount ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.campaigns.discountSendBtn}</Text>}
      </Pressable>
      {discountResult && <Text style={styles.result}>{discountResult}</Text>}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 20 },
    btn: { backgroundColor: colors.accent, borderRadius: RADIUS.xl, padding: 16, alignItems: 'center', ...accentGlow(colors, mode) },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    result: { marginTop: 16, color: colors.success, fontSize: 13, lineHeight: 18 },
    divider: { height: 1, backgroundColor: colors.surfaceMuted, marginVertical: 28 },
    card: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 16, gap: 10, marginBottom: 16, ...cardShadow(mode, 'sm'), ...accentBorder(colors) },
    fieldLabel: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted, marginTop: 6 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    togglePill: { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 6 },
    togglePillActive: { backgroundColor: colors.accent },
    togglePillText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    togglePillTextActive: { color: '#fff' },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
    chipActive: { backgroundColor: colors.accent },
    chipText: { fontSize: 12, color: colors.textMuted },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.text },
    saveBtn: { backgroundColor: colors.accent, borderRadius: RADIUS.md, padding: 11, alignItems: 'center', marginTop: 6 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  });
}
