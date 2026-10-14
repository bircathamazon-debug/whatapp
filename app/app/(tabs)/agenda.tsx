import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useBranch } from '../../lib/branchContext';
import { useTheme, type ThemeColors, RADIUS, cardShadow, PRESSED_SCALE } from '../../lib/theme';
import { getAppointmentsForDay, adminCancelAppointment, adminConfirmAppointment } from '../../lib/appointments';
import { getStaffByBranch } from '../../lib/staff';
import { getServicesByBranch } from '../../lib/services';
import { getBlockedTimesByBranch } from '../../lib/blockedTimes';
import { useT, useDateLocale } from '../../lib/i18n';
import type { Appointment, Staff, Service, BlockedTime } from '../../../shared/types';

const HOUR_START = 8;
const HOUR_END = 20;

type ViewMode = 'day' | 'week' | 'month';

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() - d.getDay()); // domingo = inicio de semana
  return d.getTime();
}

function startOfMonth(ms: number): number {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + n, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dateStrOf(ms: number): string {
  return new Intl.DateTimeFormat('en-CA').format(ms);
}

function todayMs(): number {
  return startOfDay(Date.now());
}

export default function AgendaScreen() {
  const router = useRouter();
  const { branchId, branches, setBranchId } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const dateLocale = useDateLocale();
  const styles = makeStyles(colors, mode);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [anchor, setAnchor] = useState<number>(todayMs());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const rangeStart = viewMode === 'day' ? startOfDay(anchor) : viewMode === 'week' ? startOfWeek(anchor) : startOfMonth(anchor);
  const rangeEnd = viewMode === 'day' ? addDays(rangeStart, 1) : viewMode === 'week' ? addDays(rangeStart, 7) : addMonths(rangeStart, 1);
  const dateStr = dateStrOf(anchor);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const [appts, staffList, serviceList, blocked] = await Promise.all([
        getAppointmentsForDay(branchId, rangeStart, rangeEnd),
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
  }, [branchId, rangeStart, rangeEnd, dateStr]);

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

  const goToDay = (ms: number) => {
    setAnchor(startOfDay(ms));
    setViewMode('day');
  };

  const goPrev = () => {
    if (viewMode === 'day') setAnchor((a) => addDays(a, -1));
    else if (viewMode === 'week') setAnchor((a) => addDays(a, -7));
    else setAnchor((a) => addMonths(a, -1));
  };
  const goNext = () => {
    if (viewMode === 'day') setAnchor((a) => addDays(a, 1));
    else if (viewMode === 'week') setAnchor((a) => addDays(a, 7));
    else setAnchor((a) => addMonths(a, 1));
  };
  const goToday = () => setAnchor(todayMs());

  if (!branchId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t.agenda.needBranch}</Text>
        <Pressable style={({ pressed }) => [styles.smallBtn, pressed && PRESSED_SCALE]} onPress={() => router.push('/settings/branches')}>
          <Text style={styles.smallBtnText}>{t.agenda.goToAdmin}</Text>
        </Pressable>
      </View>
    );
  }

  const allDayBlocks = blockedTimes.filter((b) => b.allDay);
  const hourBlocks = blockedTimes.filter((b) => !b.allDay);

  const dateObj = new Date(rangeStart);
  const dayNum = dateObj.getDate();
  const monthWeekday = new Intl.DateTimeFormat(dateLocale, { weekday: 'long', month: 'long' }).format(dateObj);
  const isToday = dateStrOf(anchor) === dateStrOf(todayMs());

  const hours: number[] = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);

  const headerLabel = (): { big: string; small: string } => {
    if (viewMode === 'day') return { big: isToday ? t.agenda.today : String(dayNum), small: monthWeekday };
    if (viewMode === 'week') {
      const weekEnd = addDays(rangeStart, 6);
      const fmt = new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: 'short' });
      return { big: `${fmt.format(rangeStart)} – ${fmt.format(weekEnd)}`, small: '' };
    }
    return { big: new Intl.DateTimeFormat(dateLocale, { month: 'long', year: 'numeric' }).format(rangeStart), small: '' };
  };
  const header = headerLabel();

  return (
    <View style={styles.container}>
      {branches.length > 1 && (
        <View style={styles.branchRow}>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              style={({ pressed }) => [styles.branchChip, b.id === branchId && styles.branchChipActive, pressed && PRESSED_SCALE]}
              onPress={() => setBranchId(b.id)}
            >
              <Text style={[styles.branchChipText, b.id === branchId && styles.branchChipTextActive]}>{b.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.viewToggleRow}>
        {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
          <Pressable
            key={m}
            style={({ pressed }) => [styles.viewToggleChip, viewMode === m && styles.viewToggleChipActive, pressed && PRESSED_SCALE]}
            onPress={() => setViewMode(m)}
          >
            <Text style={[styles.viewToggleText, viewMode === m && styles.viewToggleTextActive]}>
              {m === 'day' ? t.agenda.viewDay : m === 'week' ? t.agenda.viewWeek : t.agenda.viewMonth}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.daybar}>
        <Pressable style={({ pressed }) => pressed && PRESSED_SCALE} onPress={goNext}><Text style={styles.chev}>›</Text></Pressable>
        <Pressable style={({ pressed }) => [styles.dateWrap, pressed && PRESSED_SCALE]} onPress={goToday}>
          <Text style={styles.dayNum}>{header.big}</Text>
          {!!header.small && <Text style={styles.dayText}>{header.small}</Text>}
        </Pressable>
        <Pressable style={({ pressed }) => pressed && PRESSED_SCALE} onPress={goPrev}><Text style={styles.chev}>‹</Text></Pressable>
      </View>

      {viewMode === 'day' && allDayBlocks.length > 0 && (
        <View style={styles.allDayBanner}>
          {allDayBlocks.map((b) => (
            <Text key={b.id} style={styles.allDayBannerText}>🔒 {blockLabel(b.staffId)}{b.reason ? ` — ${b.reason}` : ''}</Text>
          ))}
        </View>
      )}

      {viewMode === 'day' && (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
                            <Pressable style={({ pressed }) => [styles.confirmBtn, pressed && PRESSED_SCALE]} onPress={() => confirm(item)}>
                              <Text style={styles.confirmBtnText}>{t.agenda.depositReceived}</Text>
                            </Pressable>
                          )}
                          <Pressable style={({ pressed }) => [styles.cancelBtn, pressed && PRESSED_SCALE]} onPress={() => cancel(item)}>
                            <Text style={styles.cancelBtnText}>{t.agenda.cancel}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {viewMode === 'week' && (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i)).map((day) => {
            const dayAppts = appointments
              .filter((a) => dateStrOf(a.startsAt) === dateStrOf(day))
              .sort((a, b) => a.startsAt - b.startsAt);
            const isDayToday = dateStrOf(day) === dateStrOf(todayMs());
            return (
              <Pressable key={day} style={({ pressed }) => [styles.weekDaySection, pressed && PRESSED_SCALE]} onPress={() => goToDay(day)}>
                <View style={styles.weekDayHeader}>
                  <View style={styles.weekDayHeaderLeft}>
                    <Text style={[styles.weekDayName, isDayToday && styles.weekDayNameToday]}>
                      {new Intl.DateTimeFormat(dateLocale, { weekday: 'short', day: '2-digit', month: '2-digit' }).format(day)}
                    </Text>
                    {isDayToday && <Text style={styles.weekTodayBadge}>{t.agenda.today}</Text>}
                  </View>
                  {dayAppts.length > 0 && (
                    <View style={styles.weekCountBadge}>
                      <Text style={styles.weekCountText}>{dayAppts.length}</Text>
                    </View>
                  )}
                </View>
                {dayAppts.length === 0 ? (
                  <Text style={styles.weekEmptyText}>{t.agenda.noAppointments}</Text>
                ) : (
                  dayAppts.map((item) => (
                    <View key={item.id} style={styles.weekApptRow}>
                      <Text style={styles.weekApptTime}>{new Date(item.startsAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
                      <Text style={styles.weekApptName} numberOfLines={1}>{item.clientName}</Text>
                      <View style={[styles.weekStatusDot, { backgroundColor: statusColor(colors, item.status) }]} />
                    </View>
                  ))
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {viewMode === 'month' && (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.monthWeekdayRow}>
            {Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(new Date(2024, 0, 7 + i))).map((w, i) => (
              <Text key={i} style={styles.monthWeekdayLabel}>{w}</Text>
            ))}
          </View>
          <MonthGrid
            monthStart={rangeStart}
            appointments={appointments}
            anchor={anchor}
            onPressDay={goToDay}
            styles={styles}
            colors={colors}
          />
        </ScrollView>
      )}
    </View>
  );
}

function MonthGrid({
  monthStart,
  appointments,
  anchor,
  onPressDay,
  styles,
  colors,
}: {
  monthStart: number;
  appointments: Appointment[];
  anchor: number;
  onPressDay: (ms: number) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  const firstWeekday = new Date(monthStart).getDay();
  const monthDate = new Date(monthStart);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const countByDay = new Map<string, number>();
  for (const a of appointments) {
    const key = dateStrOf(a.startsAt);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }
  const todayStr = dateStrOf(todayMs());
  const anchorStr = dateStrOf(anchor);

  const weeks: (number | null)[][] = [];
  for (let w = 0; w < totalCells / 7; w++) {
    const row: (number | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const cellIndex = w * 7 + d;
      const dayNum = cellIndex - firstWeekday + 1;
      row.push(dayNum >= 1 && dayNum <= daysInMonth ? addDays(monthStart, dayNum - 1) : null);
    }
    weeks.push(row);
  }

  return (
    <View>
      {weeks.map((row, wi) => (
        <View key={wi} style={styles.monthRow}>
          {row.map((cell, ci) => {
            if (cell === null) return <View key={ci} style={styles.monthCell} />;
            const cellStr = dateStrOf(cell);
            const count = countByDay.get(cellStr) ?? 0;
            const isToday = cellStr === todayStr;
            const isSelected = cellStr === anchorStr;
            return (
              <Pressable
                key={ci}
                style={({ pressed }) => [styles.monthCell, isSelected && styles.monthCellSelected, pressed && PRESSED_SCALE]}
                onPress={() => onPressDay(cell)}
              >
                <Text style={[styles.monthDayNum, isToday && styles.monthDayNumToday, isSelected && styles.monthDayNumSelected]}>
                  {new Date(cell).getDate()}
                </Text>
                {count > 0 && (
                  <View style={[styles.monthCountBadge, isSelected && styles.monthCountBadgeSelected]}>
                    <Text style={[styles.monthCountText, isSelected && styles.monthCountTextSelected]}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
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

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, backgroundColor: colors.bg },
    branchRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 0, flexWrap: 'wrap' },
    branchChip: { backgroundColor: colors.surface, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7, ...cardShadow(mode, 'sm') },
    branchChipActive: { backgroundColor: colors.accent },
    branchChipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    branchChipTextActive: { color: '#fff' },
    viewToggleRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
    viewToggleChip: { flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.pill, paddingVertical: 8, alignItems: 'center', ...cardShadow(mode, 'sm') },
    viewToggleChipActive: { backgroundColor: colors.accent },
    viewToggleText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
    viewToggleTextActive: { color: '#fff' },
    daybar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, backgroundColor: colors.surface, marginTop: 10, ...cardShadow(mode, 'sm') },
    chev: { fontSize: 20, fontWeight: '700', color: colors.accent, paddingHorizontal: 10 },
    dateWrap: { alignItems: 'center' },
    dayNum: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
    dayText: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    allDayBanner: { marginHorizontal: 16, marginTop: 12, backgroundColor: colors.dangerSoft, borderRadius: RADIUS.md, padding: 12 },
    allDayBannerText: { fontSize: 12.5, fontWeight: '700', color: colors.danger },
    list: { padding: 16, paddingTop: 12 },
    emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
    smallBtn: { backgroundColor: colors.accent, borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 11 },
    smallBtnText: { color: '#fff', fontWeight: '700' },
    hourRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 36 },
    hourLabel: { width: 42, fontSize: 11, color: colors.textMuted, paddingTop: 3, textAlign: 'right', fontVariant: ['tabular-nums'], fontWeight: '600' },
    hourLine: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch' },
    hourContent: { flex: 1, paddingBottom: 12, gap: 8 },
    blockedChip: { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: 10 },
    blockedChipText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    chip: { backgroundColor: colors.surface, borderRadius: RADIUS.md, padding: 12, borderRightWidth: 4, ...cardShadow(mode, 'sm') },
    chipRow1: { flexDirection: 'row', justifyContent: 'space-between' },
    chipName: { fontSize: 13.5, fontWeight: '700', color: colors.text },
    chipTime: { fontSize: 13.5, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
    chipMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 3 },
    chipActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    confirmBtn: { backgroundColor: colors.successSoft, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 7 },
    confirmBtnText: { color: colors.success, fontWeight: '700', fontSize: 11 },
    cancelBtn: { backgroundColor: colors.dangerSoft, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 7 },
    cancelBtnText: { color: colors.danger, fontWeight: '700', fontSize: 11 },
    // Vista semanal
    weekDaySection: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, ...cardShadow(mode, 'sm') },
    weekDayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    weekDayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    weekDayName: { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
    weekDayNameToday: { color: colors.accent },
    weekTodayBadge: { fontSize: 10, fontWeight: '700', color: colors.accent, backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
    weekCountBadge: { backgroundColor: colors.accentSoft, borderRadius: RADIUS.pill, paddingHorizontal: 8, minWidth: 22, alignItems: 'center' },
    weekCountText: { fontSize: 11, fontWeight: '800', color: colors.accent },
    weekEmptyText: { fontSize: 11.5, color: colors.textMuted, fontStyle: 'italic' },
    weekApptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    weekApptTime: { fontSize: 11.5, color: colors.textMuted, fontVariant: ['tabular-nums'], width: 42 },
    weekApptName: { fontSize: 12.5, color: colors.text, flex: 1, fontWeight: '600' },
    weekStatusDot: { width: 8, height: 8, borderRadius: 4 },
    // Vista mensual
    monthWeekdayRow: { flexDirection: 'row', marginBottom: 6 },
    monthWeekdayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'capitalize' },
    monthRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
    monthCell: { flex: 1, aspectRatio: 1, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    monthCellSelected: { backgroundColor: colors.accent },
    monthDayNum: { fontSize: 13, fontWeight: '600', color: colors.text },
    monthDayNumToday: { color: colors.accent, fontWeight: '800' },
    monthDayNumSelected: { color: '#fff' },
    monthCountBadge: { marginTop: 2, backgroundColor: colors.accentSoft, borderRadius: RADIUS.pill, paddingHorizontal: 6, minWidth: 16, alignItems: 'center' },
    monthCountBadgeSelected: { backgroundColor: 'rgba(255,255,255,0.3)' },
    monthCountText: { fontSize: 9.5, fontWeight: '800', color: colors.accent },
    monthCountTextSelected: { color: '#fff' },
  });
}
