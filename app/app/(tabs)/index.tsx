import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useBranch } from '../../lib/branchContext';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { getAppointmentsForDay, adminCancelAppointment, adminConfirmAppointment } from '../../lib/appointments';
import { getStaffByBranch } from '../../lib/staff';
import { getServicesByBranch } from '../../lib/services';
import { getBlockedTimesByBranch } from '../../lib/blockedTimes';
import { useT, useDateLocale } from '../../lib/i18n';
import type { Appointment, Staff, Service, BlockedTime } from '../../../shared/types';

const HOUR_START = 8;
const HOUR_END = 20;

function startOfDay(offsetDays: number): number {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dateStrOf(ms: number): string {
  return new Intl.DateTimeFormat('en-CA').format(ms);
}

export default function AgendaScreen() {
  const router = useRouter();
  const { branchId, branches, setBranchId } = useBranch();
  const { colors } = useTheme();
  const t = useT();
  const dateLocale = useDateLocale();
  const styles = makeStyles(colors);
  const [dayOffset, setDayOffset] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const dayStart = startOfDay(dayOffset);
  const dateStr = dateStrOf(dayStart);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const dayEnd = startOfDay(dayOffset + 1);
      const [appts, staffList, serviceList, blocked] = await Promise.all([
        getAppointmentsForDay(branchId, dayStart, dayEnd),
        getStaffByBranch(branchId),
        getServicesByBranch(branchId),
        getBlockedTimesByBranch(branchId),
      ]);
      setAppointments(appts);
      setStaff(staffList);
      setServices(serviceList);
      setBlockedTimes(blocked.filter((b) => b.date === dateStr));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const blockLabel = (staffId: string | null) => (staffId ? t.agenda.blockedForStaff(staffName(staffId)) : t.agenda.blockedForAll);
  const statusLabel = (status: Appointment['status']): string => {
    switch (status) {
      case 'confirmed': return t.agenda.statusConfirmed;
      case 'pending_deposit': return t.agenda.statusPending;
      case 'cancelled': return t.agenda.statusCancelled;
      case 'completed': return t.agenda.statusCompleted;
      case 'no_show': return t.agenda.statusNoShow;
    }
  };

  const cancel = (appt: Appointment) => {
    Alert.alert(t.agenda.cancelTitle, t.agenda.cancelMessage(appt.clientName), [
      { text: t.agenda.back, style: 'cancel' },
      { text: t.agenda.cancelAppt, style: 'destructive', onPress: async () => { await adminCancelAppointment(appt.id); await load(); } },
    ]);
  };

  const confirm = async (appt: Appointment) => {
    await adminConfirmAppointment(appt.id);
    await load();
  };

  if (!branchId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t.agenda.needBranch}</Text>
        <TouchableOpacity style={styles.smallBtn} onPress={() => router.push('/admin')}>
          <Text style={styles.smallBtnText}>{t.agenda.goToAdmin}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allDayBlocks = blockedTimes.filter((b) => b.allDay);
  const hourBlocks = blockedTimes.filter((b) => !b.allDay);

  const dateObj = new Date(dayStart);
  const dayNum = dateObj.getDate();
  const monthWeekday = new Intl.DateTimeFormat(dateLocale, { weekday: 'long', month: 'long' }).format(dateObj);

  const hours: number[] = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

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

      <View style={styles.daybar}>
        <TouchableOpacity onPress={() => setDayOffset((d) => d + 1)}><Text style={styles.chev}>›</Text></TouchableOpacity>
        <View style={styles.dateWrap}>
          <Text style={styles.dayNum}>{dayOffset === 0 ? t.agenda.today : dayNum}</Text>
          <Text style={styles.dayText}>{monthWeekday}</Text>
        </View>
        <TouchableOpacity onPress={() => setDayOffset((d) => d - 1)}><Text style={styles.chev}>‹</Text></TouchableOpacity>
      </View>

      {allDayBlocks.length > 0 && (
        <View style={styles.allDayBanner}>
          {allDayBlocks.map((b) => (
            <Text key={b.id} style={styles.allDayBannerText}>🔒 {blockLabel(b.staffId)}{b.reason ? ` — ${b.reason}` : ''}</Text>
          ))}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!loading && appointments.length === 0 && allDayBlocks.length === 0 && (
          <Text style={styles.emptyText}>{t.agenda.noAppointments}</Text>
        )}
        {hours.map((h) => {
          const hourAppts = appointments
            .filter((a) => new Date(a.startsAt).getHours() === h)
            .sort((a, b) => a.startsAt - b.startsAt);
          const hourBlock = hourBlocks.find((b) => Number(b.startTime?.split(':')[0]) === h);
          return (
            <View key={h} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{String(h).padStart(2, '0')}:00</Text>
              <View style={styles.hourLine} />
              <View style={styles.hourContent}>
                {hourBlock && (
                  <View style={styles.blockedChip}>
                    <Text style={styles.blockedChipText}>
                      🔒 {hourBlock.startTime}–{hourBlock.endTime} · {blockLabel(hourBlock.staffId)}{hourBlock.reason ? ` (${hourBlock.reason})` : ''}
                    </Text>
                  </View>
                )}
                {hourAppts.map((item) => (
                  <View key={item.id} style={[styles.chip, { borderRightColor: statusColor(colors, item.status) }]}>
                    <View style={styles.chipRow1}>
                      <Text style={styles.chipName}>{item.clientName}</Text>
                      <Text style={styles.chipTime}>{new Date(item.startsAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
                    </View>
                    <Text style={styles.chipMeta}>{serviceName(item.serviceId)} · {staffName(item.staffId)} · {statusLabel(item.status)}</Text>
                    {(item.status === 'confirmed' || item.status === 'pending_deposit') && (
                      <View style={styles.chipActions}>
                        {item.status === 'pending_deposit' && (
                          <TouchableOpacity style={styles.confirmBtn} onPress={() => confirm(item)}>
                            <Text style={styles.confirmBtnText}>{t.agenda.depositReceived}</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => cancel(item)}>
                          <Text style={styles.cancelBtnText}>{t.agenda.cancel}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function statusColor(colors: ThemeColors, status: Appointment['status']): string {
  switch (status) {
    case 'confirmed': return colors.statusConfirmed;
    case 'pending_deposit': return colors.statusPending;
    case 'completed': return colors.statusCompleted;
    case 'cancelled': return colors.statusCancelled;
    case 'no_show': return colors.statusNoShow;
  }
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, backgroundColor: colors.bg },
    branchRow: { flexDirection: 'row', gap: 8, padding: 12, flexWrap: 'wrap' },
    branchChip: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
    branchChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    branchChipText: { fontSize: 12, color: colors.textMuted },
    branchChipTextActive: { color: '#fff' },
    daybar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    chev: { fontSize: 20, fontWeight: '700', color: colors.accent, paddingHorizontal: 8 },
    dateWrap: { alignItems: 'center' },
    dayNum: { fontSize: 19, fontWeight: '800', color: colors.text },
    dayText: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    allDayBanner: { marginHorizontal: 16, marginTop: 10, backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 10 },
    allDayBannerText: { fontSize: 12.5, fontWeight: '700', color: colors.danger },
    list: { padding: 16, paddingTop: 8 },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
    smallBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    smallBtnText: { color: '#fff', fontWeight: '600' },
    hourRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, minHeight: 34 },
    hourLabel: { width: 42, fontSize: 11, color: colors.textMuted, paddingTop: 3, textAlign: 'right', fontVariant: ['tabular-nums'] },
    hourLine: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch' },
    hourContent: { flex: 1, paddingBottom: 10, gap: 6 },
    blockedChip: { backgroundColor: colors.surfaceMuted, borderRadius: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: 8 },
    blockedChipText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    chip: { backgroundColor: colors.surface, borderRadius: 10, padding: 10, borderRightWidth: 3 },
    chipRow1: { flexDirection: 'row', justifyContent: 'space-between' },
    chipName: { fontSize: 13, fontWeight: '700', color: colors.text },
    chipTime: { fontSize: 13, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
    chipMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
    chipActions: { flexDirection: 'row', gap: 7, marginTop: 8 },
    confirmBtn: { backgroundColor: colors.successSoft, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
    confirmBtnText: { color: colors.success, fontWeight: '700', fontSize: 11 },
    cancelBtn: { backgroundColor: colors.dangerSoft, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
    cancelBtnText: { color: colors.danger, fontWeight: '700', fontSize: 11 },
  });
}
