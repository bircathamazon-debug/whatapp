import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, Switch } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getStaffByBranch, addStaff, deleteStaff, updateStaff, emptyWeeklyHours } from '../../lib/staff';
import { getServicesByBranch } from '../../lib/services';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import type { Staff, Service } from '../../../shared/types';

export default function StaffScreen() {
  const { branchId } = useBranch();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [editingDurationsFor, setEditingDurationsFor] = useState<string | null>(null);
  const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!branchId) return;
    const [staffList, serviceList] = await Promise.all([getStaffByBranch(branchId), getServicesByBranch(branchId)]);
    setStaff(staffList);
    setServices(serviceList);
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!branchId || !name.trim()) return;
    await addStaff({ branchId, name: name.trim(), phone: phone.trim(), hours: emptyWeeklyHours(), blockedDates: [], active: true });
    setName('');
    setPhone('');
    await load();
  };

  const toggleActive = async (s: Staff) => {
    await updateStaff(s.id, { active: !s.active });
    await load();
  };

  const remove = (s: Staff) => {
    Alert.alert(t.staff.deleteTitle, t.staff.deleteConfirm(s.name), [
      { text: t.staff.cancel, style: 'cancel' },
      { text: t.staff.delete, style: 'destructive', onPress: async () => { await deleteStaff(s.id); await load(); } },
    ]);
  };

  const openDurations = (s: Staff) => {
    const drafts: Record<string, string> = {};
    for (const svc of services) {
      const override = s.serviceDurations?.[svc.id];
      drafts[svc.id] = override != null ? String(override) : '';
    }
    setDurationDrafts(drafts);
    setEditingDurationsFor(s.id);
  };

  const saveDurations = async (s: Staff) => {
    const serviceDurations: Record<string, number> = {};
    for (const svc of services) {
      const raw = (durationDrafts[svc.id] || '').trim();
      if (raw) {
        const minutes = Number(raw);
        if (!Number.isNaN(minutes) && minutes > 0) serviceDurations[svc.id] = minutes;
      }
    }
    await updateStaff(s.id, { serviceDurations });
    setEditingDurationsFor(null);
    await load();
  };

  if (!branchId) return <View style={styles.container}><Text style={styles.emptyText}>{t.staff.needBranch}</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={staff}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.label}>{t.staff.name}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t.staff.namePlaceholder} placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>{t.staff.phone}</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+972501234567" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            <TouchableOpacity style={styles.btn} onPress={save}>
              <Text style={styles.btnText}>{t.staff.add}</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardMeta}>{item.phone}</Text>
                </View>
                <Switch value={item.active} onValueChange={() => toggleActive(item)} />
                <TouchableOpacity onPress={() => remove(item)}>
                  <Text style={styles.delete}>🗑️</Text>
                </TouchableOpacity>
              </View>
              {services.length > 0 && (
                <TouchableOpacity
                  onPress={() => (editingDurationsFor === item.id ? setEditingDurationsFor(null) : openDurations(item))}
                >
                  <Text style={styles.durationsToggle}>{t.staff.durationsBtn}</Text>
                </TouchableOpacity>
              )}
              {editingDurationsFor === item.id && (
                <View style={styles.durationsPanel}>
                  <Text style={styles.durationsTitle}>{t.staff.durationsTitle}</Text>
                  <Text style={styles.durationsHint}>{t.staff.durationsHint}</Text>
                  {services.map((svc) => (
                    <View key={svc.id} style={styles.durationRow}>
                      <Text style={styles.durationServiceName}>{svc.name}</Text>
                      <TextInput
                        style={styles.durationInput}
                        value={durationDrafts[svc.id] ?? ''}
                        onChangeText={(v) => setDurationDrafts((prev) => ({ ...prev, [svc.id]: v }))}
                        placeholder={t.staff.durationDefaultPlaceholder(svc.durationMinutes)}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                      />
                    </View>
                  ))}
                  <TouchableOpacity style={styles.btn} onPress={() => saveDurations(item)}>
                    <Text style={styles.btnText}>{t.staff.save}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    form: { marginBottom: 8 },
    label: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border, color: colors.text },
    btn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16, marginBottom: 8 },
    btnText: { color: '#fff', fontWeight: '700' },
    card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'center', gap: 10 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
    cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    delete: { fontSize: 18, paddingHorizontal: 4 },
    durationsToggle: { fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 10 },
    durationsPanel: { marginTop: 10, backgroundColor: colors.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border },
    durationsTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 },
    durationsHint: { fontSize: 11, color: colors.textMuted, marginBottom: 10 },
    durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
    durationServiceName: { fontSize: 13, color: colors.text, flex: 1 },
    durationInput: { backgroundColor: colors.surface, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: colors.border, color: colors.text, width: 110, textAlign: 'center' },
  });
}
