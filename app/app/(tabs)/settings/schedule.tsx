import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { getStaffByBranch, updateStaff } from '../../../lib/staff';
import { useTheme, type ThemeColors } from '../../../lib/theme';
import { useT } from '../../../lib/i18n';
import type { Staff, WeeklyHours } from '../../../../shared/types';

export default function ScheduleScreen() {
  const { branchId } = useBranch();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hours, setHours] = useState<WeeklyHours>({});
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    const list = await getStaffByBranch(branchId);
    setStaffList(list);
    if (!selectedId && list[0]) selectStaff(list[0]);
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const selectStaff = (s: Staff) => {
    setSelectedId(s.id);
    setHours(s.hours);
    setBlockedDates(s.blockedDates);
  };

  const setDayOpen = (day: number, open: boolean) => {
    setHours((h) => ({ ...h, [day]: open ? { start: '09:00', end: '19:00' } : null }));
  };

  const setDayTime = (day: number, field: 'start' | 'end', value: string) => {
    setHours((h) => ({ ...h, [day]: { ...(h[day] as { start: string; end: string }), [field]: value } }));
  };

  const addBlockedDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newBlockedDate)) {
      Alert.alert(t.schedule.invalidFormatTitle, t.schedule.invalidFormatMessage);
      return;
    }
    setBlockedDates((d) => [...new Set([...d, newBlockedDate])].sort());
    setNewBlockedDate('');
  };

  const removeBlockedDate = (date: string) => setBlockedDates((d) => d.filter((x) => x !== date));

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateStaff(selectedId, { hours, blockedDates });
      Alert.alert(t.schedule.savedTitle, t.schedule.savedMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!branchId) return <View style={styles.container}><Text style={styles.emptyText}>{t.schedule.needBranch}</Text></View>;
  if (staffList.length === 0) return <View style={styles.container}><Text style={styles.emptyText}>{t.schedule.needStaff}</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.staffRow}>
        {staffList.map((s) => (
          <TouchableOpacity key={s.id} style={[styles.staffChip, s.id === selectedId && styles.staffChipActive]} onPress={() => selectStaff(s)}>
            <Text style={[styles.staffChipText, s.id === selectedId && styles.staffChipTextActive]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t.schedule.weeklyHours}</Text>
      {t.schedule.weekdays.map((name, day) => {
        const dayHours = hours[day];
        return (
          <View key={day} style={styles.dayRow}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{name}</Text>
              <Switch value={!!dayHours} onValueChange={(open) => setDayOpen(day, open)} />
            </View>
            {dayHours && (
              <View style={styles.timeRow}>
                <TextInput style={styles.timeInput} value={dayHours.start} onChangeText={(v) => setDayTime(day, 'start', v)} placeholder="09:00" placeholderTextColor={colors.textMuted} />
                <Text style={styles.timeSep}>{t.schedule.until}</Text>
                <TextInput style={styles.timeInput} value={dayHours.end} onChangeText={(v) => setDayTime(day, 'end', v)} placeholder="19:00" placeholderTextColor={colors.textMuted} />
              </View>
            )}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>{t.schedule.blockedDays}</Text>
      <View style={styles.timeRow}>
        <TextInput style={[styles.timeInput, { flex: 1 }]} value={newBlockedDate} onChangeText={setNewBlockedDate} placeholder="2026-04-23" placeholderTextColor={colors.textMuted} />
        <TouchableOpacity style={styles.addBtn} onPress={addBlockedDate}>
          <Text style={styles.addBtnText}>{t.schedule.addBtn}</Text>
        </TouchableOpacity>
      </View>
      {blockedDates.map((date) => (
        <View key={date} style={styles.blockedRow}>
          <Text style={styles.blockedDate}>{date}</Text>
          <TouchableOpacity onPress={() => removeBlockedDate(date)}><Text style={styles.delete}>🗑️</Text></TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? t.schedule.saving : t.schedule.save}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    staffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    staffChip: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
    staffChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    staffChipText: { color: colors.textMuted, fontWeight: '600' },
    staffChipTextActive: { color: '#fff' },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 10 },
    dayRow: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
    dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dayName: { fontSize: 14, fontWeight: '600', color: colors.text },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    timeInput: { backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 10, width: 80, textAlign: 'center', color: colors.text },
    timeSep: { color: colors.textMuted },
    addBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
    blockedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: 10, marginTop: 6 },
    blockedDate: { color: colors.text },
    delete: { fontSize: 16 },
    saveBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
