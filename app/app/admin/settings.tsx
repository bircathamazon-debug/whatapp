import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { updateBranch } from '../../lib/branches';
import { getStaffByBranch } from '../../lib/staff';
import { LOYALTY_THRESHOLD, NO_SHOW_DEPOSIT_THRESHOLD, REMINDER_WINDOWS_HOURS } from '../../../shared/types';
import type { Staff, Branch } from '../../../shared/types';

const SHABBAT_MODES: { value: Branch['shabbatMode']; label: string; hint: string }[] = [
  { value: 'off', label: 'Desactivado', hint: 'Se puede reservar y se avisa al peluquero en cualquier momento.' },
  { value: 'silent', label: 'Silencioso (recomendado)', hint: 'Se puede reservar en Shabat, pero el aviso al peluquero se retiene hasta Motzaei Shabat.' },
  { value: 'closed', label: 'Cerrado', hint: 'No se aceptan reservas nuevas durante Shabat.' },
];

const FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL;

export default function SettingsScreen() {
  const { branchId, branches, reload } = useBranch();
  const branch = branches.find((b) => b.id === branchId);
  const [staff, setStaff] = useState<Staff[]>([]);

  useEffect(() => {
    if (branchId) getStaffByBranch(branchId).then(setStaff);
  }, [branchId]);

  const setShabbatMode = async (mode: Branch['shabbatMode']) => {
    if (!branchId) return;
    await updateBranch(branchId, { shabbatMode: mode });
    await reload();
  };

  const connectGoogleCalendar = (staffId: string) => {
    if (!FUNCTIONS_BASE_URL) {
      Alert.alert('Falta configuración', 'Define EXPO_PUBLIC_FUNCTIONS_BASE_URL en app/.env para habilitar la conexión con Google Calendar.');
      return;
    }
    Linking.openURL(`${FUNCTIONS_BASE_URL}/googleCalendarConnect?staffId=${staffId}`);
  };

  if (!branch) return <View style={styles.container}><Text style={styles.emptyText}>Selecciona una sucursal primero.</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>Modo Shabat — {branch.name}</Text>
      {SHABBAT_MODES.map((m) => (
        <TouchableOpacity key={m.value} style={[styles.option, branch.shabbatMode === m.value && styles.optionActive]} onPress={() => setShabbatMode(m.value)}>
          <Text style={[styles.optionLabel, branch.shabbatMode === m.value && styles.optionLabelActive]}>{m.label}</Text>
          <Text style={styles.optionHint}>{m.hint}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Google Calendar (opcional)</Text>
      <Text style={styles.hint}>Cada peluquero puede conectar su propio Google Calendar; sus citas se agregarán automáticamente.</Text>
      {staff.map((s) => (
        <TouchableOpacity key={s.id} style={styles.calendarBtn} onPress={() => connectGoogleCalendar(s.id)}>
          <Text style={styles.calendarBtnText}>Conectar calendario de {s.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Reglas del sistema</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoLine}>🎁 Fidelidad: descuento cada {LOYALTY_THRESHOLD} cortes completados.</Text>
        <Text style={styles.infoLine}>⚠️ Depósito obligatorio tras {NO_SHOW_DEPOSIT_THRESHOLD} inasistencias.</Text>
        <Text style={styles.infoLine}>⏰ Recordatorios automáticos: {REMINDER_WINDOWS_HOURS.map((h) => `${h}h`).join(' y ')} antes de la cita.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a3c5e', marginTop: 20, marginBottom: 10 },
  hint: { fontSize: 12, color: '#666', marginBottom: 10, lineHeight: 18 },
  option: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  optionActive: { borderColor: '#1a3c5e' },
  optionLabel: { fontSize: 14, fontWeight: '700', color: '#333' },
  optionLabelActive: { color: '#1a3c5e' },
  optionHint: { fontSize: 12, color: '#666', marginTop: 4 },
  calendarBtn: { backgroundColor: '#e8f0fe', borderRadius: 10, padding: 14, marginBottom: 8 },
  calendarBtnText: { color: '#1a3c5e', fontWeight: '600', fontSize: 13 },
  infoCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14 },
  infoLine: { fontSize: 13, color: '#555', marginBottom: 6 },
});
