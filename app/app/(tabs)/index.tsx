import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBranch } from '../../lib/branchContext';
import { useTheme, type ThemeColors, RADIUS, cardShadow, accentGlow, accentBorder } from '../../lib/theme';
import { getAppointmentsForDay } from '../../lib/appointments';
import { getServicesByBranch } from '../../lib/services';
import { getStaffByBranch } from '../../lib/staff';
import { getUnansweredByBranch } from '../../lib/unansweredMessages';
import { useT, useDateLocale } from '../../lib/i18n';
import type { Appointment, Service, Staff } from '../../../shared/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function startOfDay(offsetDays = 0): number {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function HomeScreen() {
  const router = useRouter();
  const { branchId, branches, setBranchId } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const dateLocale = useDateLocale();
  const styles = makeStyles(colors, mode);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    const [appts, serviceList, staffList, questions] = await Promise.all([
      getAppointmentsForDay(branchId, startOfDay(0), startOfDay(1)),
      getServicesByBranch(branchId),
      getStaffByBranch(branchId),
      getUnansweredByBranch(branchId),
    ]);
    setAppointments(appts);
    setServices(serviceList);
    setStaff(staffList);
    setQuestionsCount(questions.filter((q) => !q.resolved).length);
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!branchId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t.agenda.needBranch}</Text>
        <Pressable style={({ pressed }) => [styles.smallBtn, pressed && styles.pressedScale]} onPress={() => router.push('/settings/branches')}>
          <Text style={styles.smallBtnText}>{t.agenda.goToAdmin}</Text>
        </Pressable>
      </View>
    );
  }

  const priceById = new Map(services.map((s) => [s.id, s.price]));
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const active = appointments.filter((a) => a.status !== 'cancelled');
  const completed = appointments.filter((a) => a.status === 'completed');
  const todayRevenue = completed.reduce((sum, a) => sum + (priceById.get(a.serviceId) ?? 0), 0);

  const now = Date.now();
  const upcoming = active
    .filter((a) => a.startsAt >= now && (a.status === 'confirmed' || a.status === 'pending_deposit'))
    .sort((a, b) => a.startsAt - b.startsAt);
  const next = upcoming[0];

  const dateHeader = new Intl.DateTimeFormat(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }).format(Date.now());

  const QUICK_ACTIONS: { icon: IconName; label: string; color: string; onPress: () => void }[] = [
    { icon: 'calendar', label: t.tabs.agenda, color: colors.accent, onPress: () => router.push('/agenda') },
    { icon: 'wallet', label: t.finance.title, color: colors.success, onPress: () => router.push('/finance') },
    { icon: 'people', label: t.tabs.clients, color: colors.statusPending, onPress: () => router.push('/more/clients') },
    { icon: 'settings', label: t.settings.title, color: colors.accent, onPress: () => router.push('/settings') },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {branches.length > 1 && (
        <View style={styles.branchRow}>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              style={({ pressed }) => [styles.branchChip, b.id === branchId && styles.branchChipActive, pressed && styles.pressedScale]}
              onPress={() => setBranchId(b.id)}
            >
              <Text style={[styles.branchChipText, b.id === branchId && styles.branchChipTextActive]}>{b.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.dateEyebrow}>{dateHeader}</Text>
      <Text style={styles.greeting}>{t.home.greeting}</Text>

      <View style={styles.heroCard}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="cash" size={16} color="#fff" />
        </View>
        <View>
          <Text style={styles.heroLabel}>{t.finance.todayRevenueTitle}</Text>
          <Text style={styles.heroAmount}>₪{todayRevenue}</Text>
        </View>
      </View>

      <View style={styles.secondaryRow}>
        <View style={styles.secondaryChip}>
          <Ionicons name="calendar" size={15} color={colors.accent} />
          <Text style={styles.secondaryChipText}>{t.home.todayApptsLabel(active.length)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t.home.nextApptTitle}</Text>
      {next ? (
        <View style={styles.nextCard}>
          <Text style={styles.nextTime}>
            {new Date(next.startsAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false })}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextName}>{next.clientName}</Text>
            <Text style={styles.nextMeta}>{serviceName(next.serviceId)} · {staffName(next.staffId)}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.nextCardEmpty}>
          <Text style={styles.emptyInlineText}>{t.home.nextApptNone}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>{t.home.quickActionsTitle}</Text>
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((qa) => (
          <Pressable
            key={qa.label}
            style={({ pressed }) => [styles.quickTile, { backgroundColor: qa.color }, pressed && styles.pressedScale]}
            onPress={qa.onPress}
          >
            <Ionicons name={qa.icon} size={22} color="#fff" />
            <Text style={styles.quickLabel}>{qa.label}</Text>
          </Pressable>
        ))}
      </View>

      {questionsCount > 0 && (
        <Pressable style={({ pressed }) => [styles.alertCard, pressed && styles.pressedScale]} onPress={() => router.push('/more/questions')}>
          <View style={[styles.alertIconWrap, { backgroundColor: colors.statusPending }]}>
            <Ionicons name="help-circle" size={18} color="#fff" />
          </View>
          <Text style={styles.alertText}>{t.home.questionsAlert(questionsCount)}</Text>
          <Text style={styles.alertLink}>{t.home.viewQuestions}</Text>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>{t.home.upcomingTitle}</Text>
      {upcoming.length === 0 ? (
        <Text style={styles.emptyInlineText}>{t.home.upcomingEmpty}</Text>
      ) : (
        upcoming.slice(0, 5).map((item) => (
          <View key={item.id} style={styles.upcomingRow}>
            <Text style={styles.upcomingTime}>
              {new Date(item.startsAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.upcomingName}>{item.clientName}</Text>
              <Text style={styles.upcomingMeta}>{serviceName(item.serviceId)} · {staffName(item.staffId)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, backgroundColor: colors.bg },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
    smallBtn: { backgroundColor: colors.accent, borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 11 },
    smallBtnText: { color: '#fff', fontWeight: '700' },
    branchRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
    branchChip: { backgroundColor: colors.surface, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7, ...cardShadow(mode, 'sm') },
    branchChipActive: { backgroundColor: colors.accent },
    branchChipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    branchChipTextActive: { color: '#fff' },
    dateEyebrow: { fontSize: 12, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    greeting: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.4, marginTop: 2, marginBottom: 12 },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: 13,
      marginBottom: 14,
      borderRightWidth: 3,
      borderRightColor: colors.statusPending,
      ...cardShadow(mode, 'sm'),
    },
    alertIconWrap: { width: 32, height: 32, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    alertText: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 13 },
    alertLink: { color: colors.accent, fontWeight: '800', fontSize: 12 },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 6,
      ...cardShadow(mode, 'sm'),
      ...accentBorder(colors),
    },
    heroIconWrap: {
      width: 30,
      height: 30,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...accentGlow(colors, mode),
    },
    heroLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    heroAmount: { fontSize: 20, fontWeight: '800', color: colors.accent, letterSpacing: -0.4 },
    secondaryRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    secondaryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 14,
      paddingVertical: 10,
      ...cardShadow(mode, 'sm'),
      ...accentBorder(colors),
    },
    secondaryChipText: { fontSize: 12.5, color: colors.text, fontWeight: '600' },
    sectionTitle: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 12, marginBottom: 6 },
    nextCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: 12,
      borderRightWidth: 4,
      borderRightColor: colors.accent,
      ...cardShadow(mode, 'md'),
    },
    nextTime: { fontSize: 18, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },
    nextName: { fontSize: 15, fontWeight: '700', color: colors.text },
    nextMeta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    nextCardEmpty: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 16, ...cardShadow(mode, 'sm') },
    emptyInlineText: { color: colors.textMuted, fontSize: 13 },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    quickTile: {
      width: '47%',
      borderRadius: RADIUS.lg,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      ...cardShadow(mode, 'sm'),
    },
    quickLabel: { fontSize: 12, fontWeight: '700', color: '#fff', textAlign: 'center' },
    upcomingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: 10,
      borderRightWidth: 3,
      borderRightColor: colors.accent,
      marginBottom: 6,
      ...cardShadow(mode, 'sm'),
    },
    upcomingTime: { fontSize: 13, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },
    upcomingName: { fontSize: 13.5, fontWeight: '700', color: colors.text },
    upcomingMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
    /** Feedback táctil instantáneo al tocar (no al soltar) — principio de
     * Apple de "responder en el instante del toque". */
    pressedScale: { transform: [{ scale: 0.96 }], opacity: 0.85 },
  });
}
