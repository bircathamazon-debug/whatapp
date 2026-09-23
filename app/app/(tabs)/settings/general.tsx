import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Linking, Alert, Switch } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { updateBranch } from '../../../lib/branches';
import { getStaffByBranch } from '../../../lib/staff';
import { getBlockedTimesByBranch, addBlockedTime, deleteBlockedTime } from '../../../lib/blockedTimes';
import { useTheme, type ThemeColors, RADIUS, cardShadow, accentBorder } from '../../../lib/theme';
import { useT, isRtl, LANGUAGE_NAMES, type Lang } from '../../../lib/i18n';
import { LOYALTY_THRESHOLD, NO_SHOW_DEPOSIT_THRESHOLD, REMINDER_WINDOWS_HOURS } from '../../../../shared/types';
import type { Staff, Branch, BlockedTime } from '../../../../shared/types';

function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA').format(Date.now());
}

const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL;

export default function SettingsScreen() {
  const { branchId, branches, reload } = useBranch();
  const branch = branches.find((b) => b.id === branchId);
  const { colors, mode } = useTheme();
  const t = useT();
  const SHABBAT_MODES: { value: Branch['shabbatMode']; label: string; hint: string }[] = [
    { value: 'off', label: t.settings.shabbatOffLabel, hint: t.settings.shabbatOffHint },
    { value: 'silent', label: t.settings.shabbatSilentLabel, hint: t.settings.shabbatSilentHint },
    { value: 'closed', label: t.settings.shabbatClosedLabel, hint: t.settings.shabbatClosedHint },
  ];
  const styles = makeStyles(colors, mode);
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

  const toggleMaintenance = async (value: boolean) => {
    if (!branchId) return;
    await updateBranch(branchId, { maintenanceMode: value });
    await reload();
  };

  const setLanguage = async (lang: Lang) => {
    if (!branchId) return;
    const currentLang: Lang = (branch?.language as Lang) ?? 'he';
    await updateBranch(branchId, { language: lang });
    await reload();
    if (isRtl(lang) !== isRtl(currentLang)) {
      Alert.alert(t.settings.restartTitle, t.settings.restartMessage);
    }
  };

  const connectGoogleCalendar = (staffId: string) => {
    if (!FUNCTIONS_BASE_URL) {
      Alert.alert(t.settings.missingConfigTitle, t.settings.missingConfigMessage);
      return;
    }
    Linking.openURL(`${FUNCTIONS_BASE_URL}/googleCalendarConnect?staffId=${staffId}`);
  };

  const submitBlock = async () => {
    if (!branchId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate)) {
      Alert.alert(t.settings.invalidDateTitle, t.settings.invalidDateMessage);
      return;
    }
    if (!blockAllDay && (!/^\d{2}:\d{2}$/.test(blockStart) || !/^\d{2}:\d{2}$/.test(blockEnd))) {
      Alert.alert(t.settings.invalidTimeTitle, t.settings.invalidTimeMessage);
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
    Alert.alert(t.settings.deleteBlockTitle, t.settings.deleteBlockConfirm, [
      { text: t.settings.cancel, style: 'cancel' },
      { text: t.settings.delete, style: 'destructive', onPress: async () => { await deleteBlockedTime(b.id); await loadExtras(); } },
    ]);
  };

  if (!branch) return <View style={styles.container}><Text style={styles.emptyText}>{t.settings.needBranch}</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={[styles.maintenanceCard, branch.maintenanceMode && styles.maintenanceCardActive]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.maintenanceTitle}>{t.settings.maintenanceTitle}</Text>
          <Text style={styles.maintenanceHint}>
            {branch.maintenanceMode ? t.settings.maintenanceActiveHint : t.settings.maintenanceHint}
          </Text>
        </View>
        <Switch value={!!branch.maintenanceMode} onValueChange={toggleMaintenance} />
      </View>

      <Text style={styles.sectionTitle}>{t.settings.languageTitle}</Text>
      <Text style={styles.hint}>{t.settings.languageHint}</Text>
      <View style={styles.chipsRow}>
        {(Object.keys(LANGUAGE_NAMES) as Lang[]).map((lang) => (
          <TouchableOpacity key={lang} style={[styles.staffChip, ((branch.language as Lang) ?? 'he') === lang && styles.staffChipActive]} onPress={() => setLanguage(lang)}>
            <Text style={[styles.staffChipText, ((branch.language as Lang) ?? 'he') === lang && styles.staffChipTextActive]}>{LANGUAGE_NAMES[lang]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t.settings.displayMode}</Text>
      <View style={styles.segmented}>
        <TouchableOpacity style={[styles.segment, (branch.themeMode ?? 'light') === 'light' && styles.segmentActive]} onPress={() => setThemeMode('light')}>
          <Text style={[styles.segmentText, (branch.themeMode ?? 'light') === 'light' && styles.segmentTextActive]}>{t.settings.light}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segment, branch.themeMode === 'dark' && styles.segmentActive]} onPress={() => setThemeMode('dark')}>
          <Text style={[styles.segmentText, branch.themeMode === 'dark' && styles.segmentTextActive]}>{t.settings.dark}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t.settings.blockHoursTitle}</Text>
      <Text style={styles.hint}>{t.settings.blockHoursHint}</Text>

      <View style={styles.chipsRow}>
        <TouchableOpacity style={[styles.staffChip, blockStaffId === null && styles.staffChipActive]} onPress={() => setBlockStaffId(null)}>
          <Text style={[styles.staffChipText, blockStaffId === null && styles.staffChipTextActive]}>{t.settings.allStaff}</Text>
        </TouchableOpacity>
        {staff.map((s) => (
          <TouchableOpacity key={s.id} style={[styles.staffChip, blockStaffId === s.id && styles.staffChipActive]} onPress={() => setBlockStaffId(s.id)}>
            <Text style={[styles.staffChipText, blockStaffId === s.id && styles.staffChipTextActive]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.fieldLabel}>{t.settings.dateLabel}</Text>
        <TextInput style={styles.input} value={blockDate} onChangeText={setBlockDate} placeholder="2026-09-20" placeholderTextColor={colors.textMuted} />

        <TouchableOpacity style={styles.allDayRow} onPress={() => setBlockAllDay((v) => !v)}>
          <View style={[styles.checkbox, blockAllDay && styles.checkboxActive]}>{blockAllDay && <Text style={styles.checkboxMark}>✓</Text>}</View>
          <Text style={styles.allDayLabel}>{t.settings.blockAllDay}</Text>
        </TouchableOpacity>

        {!blockAllDay && (
          <View style={styles.timeRow}>
            <TextInput style={[styles.input, styles.timeInput]} value={blockStart} onChangeText={setBlockStart} placeholder="13:00" placeholderTextColor={colors.textMuted} />
            <Text style={styles.timeSep}>{t.settings.to}</Text>
            <TextInput style={[styles.input, styles.timeInput]} value={blockEnd} onChangeText={setBlockEnd} placeholder="14:00" placeholderTextColor={colors.textMuted} />
          </View>
        )}

        <TextInput style={styles.input} value={blockReason} onChangeText={setBlockReason} placeholder={t.settings.reasonPlaceholder} placeholderTextColor={colors.textMuted} />

        <TouchableOpacity style={styles.saveBtn} onPress={submitBlock}>
          <Text style={styles.saveBtnText}>{t.settings.addBlock}</Text>
        </TouchableOpacity>
      </View>

      {blockedTimes.length > 0 && (
        <View style={{ marginTop: 4 }}>
          {blockedTimes.map((b) => (
            <View key={b.id} style={styles.blockRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.blockRowTitle}>
                  {b.date} · {b.allDay ? t.settings.fullDay : `${b.startTime}–${b.endTime}`}
                </Text>
                <Text style={styles.blockRowSub}>
                  {b.staffId ? staff.find((s) => s.id === b.staffId)?.name ?? b.staffId : t.settings.allStaff}
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

      <Text style={styles.sectionTitle}>{t.settings.shabbatMode(branch.name)}</Text>
      {SHABBAT_MODES.map((m) => (
        <TouchableOpacity key={m.value} style={[styles.option, branch.shabbatMode === m.value && styles.optionActive]} onPress={() => setShabbatMode(m.value)}>
          <Text style={[styles.optionLabel, branch.shabbatMode === m.value && styles.optionLabelActive]}>{m.label}</Text>
          <Text style={styles.optionHint}>{m.hint}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>{t.settings.googleCalendar}</Text>
      <Text style={styles.hint}>{t.settings.googleCalendarHint}</Text>
      {staff.map((s) => (
        <TouchableOpacity key={s.id} style={styles.calendarBtn} onPress={() => connectGoogleCalendar(s.id)}>
          <Text style={styles.calendarBtnText}>{t.settings.connectCalendar(s.name)}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>{t.settings.systemRules}</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoLine}>{t.settings.loyaltyRule(LOYALTY_THRESHOLD)}</Text>
        <Text style={styles.infoLine}>{t.settings.depositRule(NO_SHOW_DEPOSIT_THRESHOLD)}</Text>
        <Text style={styles.infoLine}>
          {t.settings.reminderRule(REMINDER_WINDOWS_HOURS.map((h) => (h < 1 ? t.settings.minutesShort(h * 60) : t.settings.hoursShort(h))).join(t.settings.andSeparator))}
        </Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 10 },
    hint: { fontSize: 12, color: colors.textMuted, marginBottom: 10, lineHeight: 18 },
    segmented: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.md, padding: 3, gap: 3, alignSelf: 'flex-start' },
    segment: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.sm },
    segmentActive: { backgroundColor: colors.accent },
    segmentText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
    segmentTextActive: { color: '#fff' },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    staffChip: { backgroundColor: colors.surface, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6, ...cardShadow(mode, 'sm') },
    staffChipActive: { backgroundColor: colors.accent },
    staffChipText: { fontSize: 12, color: colors.textMuted },
    staffChipTextActive: { color: '#fff', fontWeight: '600' },
    blockCard: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 14, gap: 8, ...cardShadow(mode, 'sm'), ...accentBorder(colors) },
    fieldLabel: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.text },
    allDayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    checkboxMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
    allDayLabel: { fontSize: 13, color: colors.text },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput: { flex: 1 },
    timeSep: { fontSize: 12, color: colors.textMuted },
    saveBtn: { backgroundColor: colors.accent, borderRadius: RADIUS.md, padding: 11, alignItems: 'center', marginTop: 2 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    blockRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 12, marginTop: 8, gap: 10, ...cardShadow(mode, 'sm'), ...accentBorder(colors) },
    blockRowTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
    blockRowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    blockRowDelete: { color: colors.danger, fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },
    option: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: 'transparent', ...cardShadow(mode, 'sm') },
    optionActive: { borderColor: colors.accent },
    optionLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    optionLabelActive: { color: colors.accent },
    optionHint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    calendarBtn: { backgroundColor: colors.accentSoft, borderRadius: RADIUS.lg, padding: 14, marginBottom: 8 },
    calendarBtnText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
    infoCard: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 14, ...cardShadow(mode, 'sm'), ...accentBorder(colors) },
    infoLine: { fontSize: 13, color: colors.text, marginBottom: 6 },
    maintenanceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: 'transparent', ...cardShadow(mode, 'sm') },
    maintenanceCardActive: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
    maintenanceTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    maintenanceHint: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  });
}
