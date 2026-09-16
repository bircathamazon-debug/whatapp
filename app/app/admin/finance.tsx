import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getAppointmentsForDay } from '../../lib/appointments';
import { getServicesByBranch } from '../../lib/services';
import { getExpensesByBranch, addExpense, deleteExpense } from '../../lib/expenses';
import { createSubscriptionCheckout, openBillingPortal } from '../../lib/stripe';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { useT, useDateLocale } from '../../lib/i18n';
import type { Appointment, Service, Expense } from '../../../shared/types';

function startOfDay(offsetDays = 0): number {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfNextMonth(): number {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA').format(Date.now());
}

const CATEGORIES: Expense['category'][] = ['rent', 'utilities', 'staff', 'supplies', 'other'];

export default function FinanceScreen() {
  const { branchId, branches } = useBranch();
  const branch = branches.find((b) => b.id === branchId);
  const { colors } = useTheme();
  const t = useT();
  const dateLocale = useDateLocale();
  const styles = makeStyles(colors);

  const CATEGORY_LABEL: Record<Expense['category'], string> = {
    rent: t.finance.categoryRent,
    utilities: t.finance.categoryUtilities,
    staff: t.finance.categoryStaff,
    supplies: t.finance.categorySupplies,
    other: t.finance.categoryOther,
  };

  const [services, setServices] = useState<Service[]>([]);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [monthAppts, setMonthAppts] = useState<Appointment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subscribing, setSubscribing] = useState(false);

  const [expenseCategory, setExpenseCategory] = useState<Expense['category']>('rent');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayStr());

  const load = useCallback(async () => {
    if (!branchId) return;
    const [serviceList, todayList, monthList, expenseList] = await Promise.all([
      getServicesByBranch(branchId),
      getAppointmentsForDay(branchId, startOfDay(0), startOfDay(1)),
      getAppointmentsForDay(branchId, startOfMonth(), startOfNextMonth()),
      getExpensesByBranch(branchId),
    ]);
    setServices(serviceList);
    setTodayAppts(todayList);
    setMonthAppts(monthList);
    setExpenses(expenseList);
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const priceById = new Map(services.map((s) => [s.id, s.price]));
  const revenueOf = (appts: Appointment[]) => {
    const completed = appts.filter((a) => a.status === 'completed');
    const total = completed.reduce((sum, a) => sum + (priceById.get(a.serviceId) ?? 0), 0);
    return { count: completed.length, total };
  };
  const todayRevenue = revenueOf(todayAppts);
  const monthRevenue = revenueOf(monthAppts);

  const monthPrefix = todayStr().slice(0, 7);
  const monthExpenses = expenses.filter((e) => e.date.startsWith(monthPrefix));
  const monthExpensesTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netThisMonth = monthRevenue.total - monthExpensesTotal;

  const submitExpense = async () => {
    if (!branchId) return;
    const amount = Number(expenseAmount);
    if (!amount || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return;
    await addExpense({
      branchId,
      category: expenseCategory,
      description: expenseDescription.trim() || undefined,
      amount,
      date: expenseDate,
    });
    setExpenseDescription('');
    setExpenseAmount('');
    await load();
  };

  const removeExpense = (e: Expense) => {
    Alert.alert(t.finance.deleteTitle, t.finance.deleteConfirm, [
      { text: t.finance.cancel, style: 'cancel' },
      { text: t.finance.delete, style: 'destructive', onPress: async () => { await deleteExpense(e.id); await load(); } },
    ]);
  };

  const handleStripeError = (err: unknown) => {
    const code = (err as { code?: string } | null)?.code;
    const message = code === 'functions/failed-precondition' ? t.finance.subscriptionNotConfigured : t.finance.subscriptionErrorMessage;
    Alert.alert(t.finance.subscriptionError, message);
  };

  const subscribe = async () => {
    if (!branchId) return;
    setSubscribing(true);
    try {
      const url = await createSubscriptionCheckout(branchId);
      await Linking.openURL(url);
    } catch (err) {
      handleStripeError(err);
    } finally {
      setSubscribing(false);
    }
  };

  const manageSubscription = async () => {
    if (!branchId) return;
    setSubscribing(true);
    try {
      const url = await openBillingPortal(branchId);
      await Linking.openURL(url);
    } catch (err) {
      handleStripeError(err);
    } finally {
      setSubscribing(false);
    }
  };

  if (!branch) return <View style={styles.container}><Text style={styles.emptyText}>{t.finance.needBranch}</Text></View>;

  const subscription = branch.subscription;
  const subscriptionStatusText = !subscription || subscription.status === 'none'
    ? t.finance.subscriptionNone
    : subscription.status === 'active'
      ? t.finance.subscriptionActive(subscription.currentPeriodEnd ? new Intl.DateTimeFormat(dateLocale).format(subscription.currentPeriodEnd) : '—')
      : subscription.status === 'past_due'
        ? t.finance.subscriptionPastDue
        : t.finance.subscriptionCanceled;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.revenueRow}>
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>{t.finance.todayRevenueTitle}</Text>
          <Text style={styles.revenueAmount}>₪{todayRevenue.total}</Text>
          <Text style={styles.revenueMeta}>{t.finance.cutsCount(todayRevenue.count)}</Text>
        </View>
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>{t.finance.monthRevenueTitle}</Text>
          <Text style={styles.revenueAmount}>₪{monthRevenue.total}</Text>
          <Text style={styles.revenueMeta}>{t.finance.cutsCount(monthRevenue.count)}</Text>
        </View>
      </View>

      <View style={[styles.netCard, netThisMonth >= 0 ? styles.netPositive : styles.netNegative]}>
        <Text style={styles.netLabel}>{t.finance.netTitle}</Text>
        <Text style={styles.netAmount}>₪{netThisMonth}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t.finance.subscriptionTitle}</Text>
      <View style={styles.subscriptionCard}>
        <Text style={styles.subscriptionStatus}>{subscriptionStatusText}</Text>
        <TouchableOpacity
          style={styles.saveBtn}
          disabled={subscribing}
          onPress={subscription?.status === 'active' ? manageSubscription : subscribe}
        >
          <Text style={styles.saveBtnText}>{subscription?.status === 'active' ? t.finance.manageBtn : t.finance.subscribeBtn}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t.finance.expensesTitle}</Text>
      <Text style={styles.hint}>{t.finance.expensesHint}</Text>

      <View style={styles.chipsRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, expenseCategory === c && styles.chipActive]} onPress={() => setExpenseCategory(c)}>
            <Text style={[styles.chipText, expenseCategory === c && styles.chipTextActive]}>{CATEGORY_LABEL[c]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.expenseForm}>
        <Text style={styles.fieldLabel}>{t.finance.dateLabel}</Text>
        <TextInput style={styles.input} value={expenseDate} onChangeText={setExpenseDate} placeholder="2026-09-20" placeholderTextColor={colors.textMuted} />
        <Text style={styles.fieldLabel}>{t.finance.amountPlaceholder}</Text>
        <TextInput style={styles.input} value={expenseAmount} onChangeText={setExpenseAmount} placeholder="500" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
        <TextInput style={styles.input} value={expenseDescription} onChangeText={setExpenseDescription} placeholder={t.finance.descriptionPlaceholder} placeholderTextColor={colors.textMuted} />
        <TouchableOpacity style={styles.saveBtn} onPress={submitExpense}>
          <Text style={styles.saveBtnText}>{t.finance.addExpense}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t.finance.monthExpensesTitle}: ₪{monthExpensesTotal}</Text>
      {monthExpenses.map((e) => (
        <View key={e.id} style={styles.expenseRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.expenseRowTitle}>{CATEGORY_LABEL[e.category]} · ₪{e.amount}</Text>
            <Text style={styles.expenseRowSub}>{e.date}{e.description ? ` · ${e.description}` : ''}</Text>
          </View>
          <TouchableOpacity onPress={() => removeExpense(e)}>
            <Text style={styles.expenseRowDelete}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 10 },
    hint: { fontSize: 12, color: colors.textMuted, marginBottom: 10, lineHeight: 18 },
    revenueRow: { flexDirection: 'row', gap: 10 },
    revenueCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
    revenueLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    revenueAmount: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 6 },
    revenueMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    netCard: { borderRadius: 12, padding: 14, marginTop: 10 },
    netPositive: { backgroundColor: colors.successSoft },
    netNegative: { backgroundColor: colors.dangerSoft },
    netLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    netAmount: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 6 },
    subscriptionCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 10 },
    subscriptionStatus: { fontSize: 13, color: colors.text, lineHeight: 19 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { fontSize: 12, color: colors.textMuted },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    expenseForm: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 8 },
    fieldLabel: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.text },
    saveBtn: { backgroundColor: colors.accent, borderRadius: 8, padding: 11, alignItems: 'center', marginTop: 2 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    expenseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginTop: 8, gap: 10 },
    expenseRowTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
    expenseRowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    expenseRowDelete: { color: colors.danger, fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },
  });
}
