import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getStaffByBranch, updateStaff } from '../../lib/staff';
import type { Staff, WeeklyHours } from '../../../shared/types';

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function ScheduleScreen() {
  const { branchId } = useBranch();
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
      Alert.alert('Formato inválido', 'Usa AAAA-MM-DD, ej. 2026-04-23');
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
      Alert.alert('Guardado', 'Horario actualizado.');
    } finally {
      setSaving(false);
    }
  };

  if (!branchId) return <View style={styles.container}><Text style={styles.emptyText}>Crea primero una sucursal.</Text></View>;
  if (staffList.length === 0) return <View style={styles.container}><Text style={styles.emptyText}>Agrega primero un peluquero.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.staffRow}>
        {staffList.map((s) => (
          <TouchableOpacity key={s.id} style={[styles.staffChip, s.id === selectedId && styles.staffChipActive]} onPress={() => selectStaff(s)}>
            <Text style={[styles.staffChipText, s.id === selectedId && styles.staffChipTextActive]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Horario semanal</Text>
      {WEEKDAY_NAMES.map((name, day) => {
        const dayHours = hours[day];
        return (
          <View key={day} style={styles.dayRow}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{name}</Text>
              <Switch value={!!dayHours} onValueChange={(open) => setDayOpen(day, open)} />
            </View>
            {dayHours && (
              <View style={styles.timeRow}>
                <TextInput style={styles.timeInput} value={dayHours.start} onChangeText={(v) => setDayTime(day, 'start', v)} placeholder="09:00" />
                <Text style={styles.timeSep}>a</Text>
                <TextInput style={styles.timeInput} value={dayHours.end} onChangeText={(v) => setDayTime(day, 'end', v)} placeholder="19:00" />
              </View>
            )}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Días bloqueados (vacaciones, feriados)</Text>
      <View style={styles.timeRow}>
        <TextInput style={[styles.timeInput, { flex: 1 }]} value={newBlockedDate} onChangeText={setNewBlockedDate} placeholder="2026-04-23" placeholderTextColor="#aaa" />
        <TouchableOpacity style={styles.addBtn} onPress={addBlockedDate}>
          <Text style={styles.addBtnText}>Agregar</Text>
        </TouchableOpacity>
      </View>
      {blockedDates.map((date) => (
        <View key={date} style={styles.blockedRow}>
          <Text style={styles.blockedDate}>{date}</Text>
          <TouchableOpacity onPress={() => removeBlockedDate(date)}><Text style={styles.delete}>🗑️</Text></TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar horario'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40 },
  staffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  staffChip: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  staffChipActive: { backgroundColor: '#1a3c5e', borderColor: '#1a3c5e' },
  staffChipText: { color: '#555', fontWeight: '600' },
  staffChipTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a3c5e', marginTop: 20, marginBottom: 10 },
  dayRow: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { fontSize: 14, fontWeight: '600', color: '#1a3c5e' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  timeInput: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 10, width: 80, textAlign: 'center', color: '#1a3c5e' },
  timeSep: { color: '#888' },
  addBtn: { backgroundColor: '#1a3c5e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  blockedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 10, marginTop: 6 },
  blockedDate: { color: '#1a3c5e' },
  delete: { fontSize: 16 },
  saveBtn: { backgroundColor: '#1a3c5e', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
