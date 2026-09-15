import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, Switch } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getStaffByBranch, addStaff, deleteStaff, updateStaff, emptyWeeklyHours } from '../../lib/staff';
import { useTheme, type ThemeColors } from '../../lib/theme';
import type { Staff } from '../../../shared/types';

export default function StaffScreen() {
  const { branchId } = useBranch();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    if (!branchId) return;
    setStaff(await getStaffByBranch(branchId));
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
    Alert.alert('מחיקת ספר', `למחוק את ${s.name}?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחיקה', style: 'destructive', onPress: async () => { await deleteStaff(s.id); await load(); } },
    ]);
  };

  if (!branchId) return <View style={styles.container}><Text style={styles.emptyText}>יש ליצור סניף קודם.</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={staff}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.label}>שם</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="דוד" placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>טלפון (יקבל הודעות על תורים חדשים)</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+972501234567" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            <TouchableOpacity style={styles.btn} onPress={save}>
              <Text style={styles.btnText}>הוספת ספר</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.phone}</Text>
            </View>
            <Switch value={item.active} onValueChange={() => toggleActive(item)} />
            <TouchableOpacity onPress={() => remove(item)}>
              <Text style={styles.delete}>🗑️</Text>
            </TouchableOpacity>
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
    cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
    cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    delete: { fontSize: 18, paddingHorizontal: 4 },
  });
}
