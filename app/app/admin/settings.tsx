import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Linking, Alert } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { updateBranch } from '../../lib/branches';
import { getStaffByBranch } from '../../lib/staff';
import { getBlockedTimesByBranch, addBlockedTime, deleteBlockedTime } from '../../lib/blockedTimes';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { LOYALTY_THRESHOLD, NO_SHOW_DEPOSIT_THRESHOLD, REMINDER_WINDOWS_HOURS } from '../../../shared/types';
import type { Staff, Branch, BlockedTime } from '../../../shared/types';

const SHABBAT_MODES: { value: Branch['shabbatMode']; label: string; hint: string }[] = [
  { value: 'off', label: 'כבוי', hint: 'אפשר להזמין תור ומודיעים לספר בכל שעה.' },
  { value: 'silent', label: 'שקט (מומלץ)', hint: 'אפשר להזמין תור בשבת, אבל ההודעה לספר מתעכבת עד מוצאי שבת.' },
  { value: 'closed', label: 'סגור', hint: 'לא מתקבלות הזמנות חדשות בשבת.' },
];

function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA').format(Date.now());
}

const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL;

export default function SettingsScreen() {
  const { branchId, branches, reload } = useBranch();
  const branch = branches.find((b) => b.id === branchId);
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);

  const [blockDate, setBlockDate] = useState(todayStr());
  const [blockStaffId, setBlockStaffId] = useState<string | null>(null);
  const [blockAllDay, setBlockAllDay] = useState(false);
  const [blockStart, setBlockStart] = useState('13:00');
  const [blockEnd, setBlockEnd] = useState('14:00');
  const [blockReason, setBlockReason] = useState('');

  const loadExtras = async () => {
    if (!branchId) return;
    const [staffList, blocks] = await Promise.all([getStaffByBranch(branchId), getBlockedTimesByBranch(branchId)]);
    setStaff(staffList);
    setBlockedTimes(blocks);
  };

  useEffect(() => {
    loadExtras();
  }, [branchId]);

  const setShabbatMode = async (mode: Branch['shabbatMode']) => {
    if (!branchId) return;
    await updateBranch(branchId, { shabbatMode: mode });
    await reload();
  };

  const setThemeMode = async (mode: 'light' | 'dark') => {
    if (!branchId) return;
    await updateBranch(branchId, { themeMode: mode });
    await reload();
  };

  const connectGoogleCalendar = (staffId: string) => {
    if (!FUNCTIONS_BASE_URL) {
      Alert.alert('חסרה הגדרה', 'יש להגדיר EXPO_PUBLIC_FUNCTIONS_BASE_URL בקובץ app/.env כדי לחבר את Google Calendar.');
      return;
    }
    Linking.openURL(`${FUNCTIONS_BASE_URL}/googleCalendarConnect?staffId=${staffId}`);
  };

  const submitBlock = async () => {
    if (!branchId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate)) {
      Alert.alert('תאריך לא תקין', 'יש להזין תאריך בפורמט YYYY-MM-DD, למשל 2026-09-20.');
      return;
    }
    if (!blockAllDay && (!/^\d{2}:\d{2}$/.test(blockStart) || !/^\d{2}:\d{2}$/.test(blockEnd))) {
      Alert.alert('שעה לא תקינה', 'יש להזין שעה בפורמט HH:mm, למשל 13:00.');
      return;
    }
    await addBlockedTime({
      branchId,
      staffId: blockStaffId,
      date: blockDate,
      allDay: blockAllDay,
      startTime: blockAllDay ? null : blockStart,
      endTime: blockAllDay ? null : blockEnd,
      reason: blockReason.trim() || undefined,
    });
    setBlockReason('');
    await loadExtras();
  };

  const removeBlock = (b: BlockedTime) => {
    Alert.alert('מחיקת חסימה', 'למחוק את החסימה הזו?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחיקה', style: 'destructive', onPress: async () => { await deleteBlockedTime(b.id); await loadExtras(); } },
    ]);
  };

  if (!branch) return <View style={styles.container}><Text style={styles.emptyText}>יש לבחור סניף קודם.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>מצב תצוגה</Text>
      <View style={styles.segmented}>
        <TouchableOpacity style={[styles.segment, (branch.themeMode ?? 'light') === 'light' && styles.segmentActive]} onPress={() => setThemeMode('light')}>
          <Text style={[styles.segmentText, (branch.themeMode ?? 'light') === 'light' && styles.segmentTextActive]}>☀️ בהיר</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segment, branch.themeMode === 'dark' && styles.segmentActive]} onPress={() => setThemeMode('dark')}>
          <Text style={[styles.segmentText, branch.themeMode === 'dark' && styles.segmentTextActive]}>🌙 כהה</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>חסימת שעות עבודה</Text>
      <Text style={styles.hint}>לחגים, תורים אישיים או חופשות — השעות החסומות לא יוצעו ללקוחות בוואטסאפ או בטלפון.</Text>

      <View style={styles.chipsRow}>
        <TouchableOpacity style={[styles.staffChip, blockStaffId === null && styles.staffChipActive]} onPress={() => setBlockStaffId(null)}>
          <Text style={[styles.staffChipText, blockStaffId === null && styles.staffChipTextActive]}>כל הצוות</Text>
        </TouchableOpacity>
        {staff.map((s) => (
          <TouchableOpacity key={s.id} style={[styles.staffChip, blockStaffId === s.id && styles.staffChipActive]} onPress={() => setBlockStaffId(s.id)}>
            <Text style={[styles.staffChipText, blockStaffId === s.id && styles.staffChipTextActive]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.fieldLabel}>תאריך (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={blockDate} onChangeText={setBlockDate} placeholder="2026-09-20" placeholderTextColor={colors.textMuted} />

        <TouchableOpacity style={styles.allDayRow} onPress={() => setBlockAllDay((v) => !v)}>
          <View style={[styles.checkbox, blockAllDay && styles.checkboxActive]}>{blockAllDay && <Text style={styles.checkboxMark}>✓</Text>}</View>
          <Text style={styles.allDayLabel}>לחסום את היום כולו</Text>
        </TouchableOpacity>

        {!blockAllDay && (
          <View style={styles.timeRow}>
            <TextInput style={[styles.input, styles.timeInput]} value={blockStart} onChangeText={setBlockStart} placeholder="13:00" placeholderTextColor={colors.textMuted} />
            <Text style={styles.timeSep}>עד</Text>
            <TextInput style={[styles.input, styles.timeInput]} value={blockEnd} onChangeText={setBlockEnd} placeholder="14:00" placeholderTextColor={colors.textMuted} />
          </View>
        )}

        <TextInput style={styles.input} value={blockReason} onChangeText={setBlockReason} placeholder="סיבה (לא חובה) — למשל חופשה" placeholderTextColor={colors.textMuted} />

        <TouchableOpacity style={styles.saveBtn} onPress={submitBlock}>
          <Text style={styles.saveBtnText}>➕ הוספת חסימה</Text>
        </TouchableOpacity>
      </View>

      {blockedTimes.length > 0 && (
        <View style={{ marginTop: 4 }}>
          {blockedTimes.map((b) => (
            <View key={b.id} style={styles.blockRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.blockRowTitle}>
                  {b.date} · {b.allDay ? 'יום שלם' : `${b.startTime}–${b.endTime}`}
                </Text>
                <Text style={styles.blockRowSub}>
                  {b.staffId ? staff.find((s) => s.id === b.staffId)?.name ?? b.staffId : 'כל הצוות'}
                  {b.reason ? ` · ${b.reason}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeBlock(b)}>
                <Text style={styles.blockRowDelete}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>מצב שבת — {branch.name}</Text>
      {SHABBAT_MODES.map((m) => (
        <TouchableOpacity key={m.value} style={[styles.option, branch.shabbatMode === m.value && styles.optionActive]} onPress={() => setShabbatMode(m.value)}>
          <Text style={[styles.optionLabel, branch.shabbatMode === m.value && styles.optionLabelActive]}>{m.label}</Text>
          <Text style={styles.optionHint}>{m.hint}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Google Calendar (אופציונלי)</Text>
      <Text style={styles.hint}>כל ספר יכול לחבר את יומן הגוגל האישי שלו — התורים שלו יתווספו אליו אוטומטית.</Text>
      {staff.map((s) => (
        <TouchableOpacity key={s.id} style={styles.calendarBtn} onPress={() => connectGoogleCalendar(s.id)}>
          <Text style={styles.calendarBtnText}>חיבור היומן של {s.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>חוקי המערכת</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoLine}>🎁 מועדון לקוחות: הנחה כל {LOYALTY_THRESHOLD} תספורות שהושלמו.</Text>
        <Text style={styles.infoLine}>⚠️ מקדמה חובה אחרי {NO_SHOW_DEPOSIT_THRESHOLD} אי-הגעות.</Text>
        <Text style={styles.infoLine}>⏰ תזכורות אוטומטיות: {REMINDER_WINDOWS_HOURS.map((h) => (h < 1 ? `${h * 60} דק'` : `${h} שעות`)).join(' ו-')} לפני התור.</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 10 },
    hint: { fontSize: 12, color: colors.textMuted, marginBottom: 10, lineHeight: 18 },
    segmented: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: 3, gap: 3, alignSelf: 'flex-start' },
    segment: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    segmentActive: { backgroundColor: colors.accent },
    segmentText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
    segmentTextActive: { color: '#fff' },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    staffChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
    staffChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    staffChipText: { fontSize: 12, color: colors.textMuted },
    staffChipTextActive: { color: '#fff', fontWeight: '600' },
    blockCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 8 },
    fieldLabel: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.text },
    allDayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    checkboxMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
    allDayLabel: { fontSize: 13, color: colors.text },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput: { flex: 1 },
    timeSep: { fontSize: 12, color: colors.textMuted },
    saveBtn: { backgroundColor: colors.accent, borderRadius: 8, padding: 11, alignItems: 'center', marginTop: 2 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    blockRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginTop: 8, gap: 10 },
    blockRowTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
    blockRowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    blockRowDelete: { color: colors.danger, fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },
    option: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
    optionActive: { borderColor: colors.accent },
    optionLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    optionLabelActive: { color: colors.accent },
    optionHint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    calendarBtn: { backgroundColor: colors.accentSoft, borderRadius: 10, padding: 14, marginBottom: 8 },
    calendarBtnText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
    infoCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 14 },
    infoLine: { fontSize: 13, color: colors.text, marginBottom: 6 },
  });
}
