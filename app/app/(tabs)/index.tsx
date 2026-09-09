import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useBranch } from '../../lib/branchContext';
import { getAppointmentsForDay, adminCancelAppointment, adminConfirmAppointment } from '../../lib/appointments';
import { getStaffByBranch } from '../../lib/staff';
import { getServicesByBranch } from '../../lib/services';
import type { Appointment, Staff, Service } from '../../../shared/types';

const STATUS_LABEL: Record<Appointment['status'], string> = {
  confirmed: 'Confirmada',
  pending_deposit: 'Espera depósito',
  cancelled: 'Cancelada',
  completed: 'Completada',
  no_show: 'No se presentó',
};

const STATUS_COLOR: Record<Appointment['status'], string> = {
  confirmed: '#2d7a4f',
  pending_deposit: '#b7791f',
  cancelled: '#a0aec0',
  completed: '#1a3c5e',
  no_show: '#e53e3e',
};

function startOfDay(offsetDays: number): number {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function AgendaScreen() {
  const router = useRouter();
  const { branchId, branches, setBranchId } = useBranch();
  const [dayOffset, setDayOffset] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const dayStart = startOfDay(dayOffset);
      const dayEnd = startOfDay(dayOffset + 1);
      const [appts, staffList, serviceList] = await Promise.all([
        getAppointmentsForDay(branchId, dayStart, dayEnd),
        getStaffByBranch(branchId),
        getServicesByBranch(branchId),
      ]);
      setAppointments(appts);
      setStaff(staffList);
      setServices(serviceList);
    } finally {
      setLoading(false);
    }
  }, [branchId, dayOffset]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;

  const cancel = (appt: Appointment) => {
    Alert.alert('Cancelar cita', `¿Cancelar la cita de ${appt.clientName}?`, [
      { text: 'Volver', style: 'cancel' },
      { text: 'Cancelar cita', style: 'destructive', onPress: async () => { await adminCancelAppointment(appt.id); await load(); } },
    ]);
  };

  const confirm = async (appt: Appointment) => {
    await adminConfirmAppointment(appt.id);
    await load();
  };

  if (!branchId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Primero crea una sucursal en el panel del peluquero.</Text>
        <TouchableOpacity style={styles.smallBtn} onPress={() => router.push('/admin')}>
          <Text style={styles.smallBtnText}>Ir al panel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {branches.length > 1 && (
        <View style={styles.branchRow}>
          {branches.map((b) => (
            <TouchableOpacity key={b.id} style={[styles.branchChip, b.id === branchId && styles.branchChipActive]} onPress={() => setBranchId(b.id)}>
              <Text style={[styles.branchChipText, b.id === branchId && styles.branchChipTextActive]}>{b.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.dayNav}>
        <TouchableOpacity onPress={() => setDayOffset((d) => d - 1)}><Text style={styles.dayNavBtn}>‹ Anterior</Text></TouchableOpacity>
        <Text style={styles.dayLabel}>{dayOffset === 0 ? 'Hoy' : new Date(startOfDay(dayOffset)).toLocaleDateString('es-ES')}</Text>
        <TouchableOpacity onPress={() => setDayOffset((d) => d + 1)}><Text style={styles.dayNavBtn}>Siguiente ›</Text></TouchableOpacity>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(a) => a.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={appointments.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No hay citas este día.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTime}>{new Date(item.startsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={[styles.badge, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
            </View>
            <Text style={styles.cardClient}>{item.clientName} · {item.clientPhone}</Text>
            <Text style={styles.cardMeta}>{serviceName(item.serviceId)} con {staffName(item.staffId)}</Text>
            {(item.status === 'confirmed' || item.status === 'pending_deposit') && (
              <View style={styles.cardActions}>
                {item.status === 'pending_deposit' && (
                  <TouchableOpacity style={styles.confirmBtn} onPress={() => confirm(item)}>
                    <Text style={styles.confirmBtnText}>Marcar depósito recibido</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={() => cancel(item)}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  branchRow: { flexDirection: 'row', gap: 8, padding: 12, flexWrap: 'wrap' },
  branchChip: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  branchChipActive: { backgroundColor: '#1a3c5e', borderColor: '#1a3c5e' },
  branchChipText: { fontSize: 12, color: '#555' },
  branchChipTextActive: { color: '#fff' },
  dayNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  dayNavBtn: { color: '#1a3c5e', fontWeight: '600' },
  dayLabel: { fontSize: 15, fontWeight: '700', color: '#1a3c5e' },
  list: { padding: 16 },
  emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', textAlign: 'center' },
  smallBtn: { backgroundColor: '#1a3c5e', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  smallBtnText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTime: { fontSize: 16, fontWeight: '800', color: '#1a3c5e' },
  badge: { fontSize: 12, fontWeight: '700' },
  cardClient: { fontSize: 14, color: '#333', marginTop: 4, fontWeight: '600' },
  cardMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  confirmBtn: { backgroundColor: '#e6f4ea', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  confirmBtnText: { color: '#2d7a4f', fontWeight: '600', fontSize: 12 },
  cancelBtn: { backgroundColor: '#fff5f5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  cancelBtnText: { color: '#e53e3e', fontWeight: '600', fontSize: 12 },
});
