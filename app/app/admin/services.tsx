import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, Switch } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getServicesByBranch, addService, deleteService } from '../../lib/services';
import { useTheme, type ThemeColors } from '../../lib/theme';
import type { Service } from '../../../shared/types';

export default function ServicesScreen() {
  const { branchId } = useBranch();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('');
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('50');

  const load = useCallback(async () => {
    if (!branchId) return;
    setServices(await getServicesByBranch(branchId));
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!branchId || !name.trim()) return;
    await addService({
      branchId,
      name: name.trim(),
      durationMinutes: Number(duration) || 30,
      price: Number(price) || 0,
      requiresDeposit,
      depositAmount: Number(depositAmount) || 0,
    });
    setName('');
    setPrice('');
    await load();
  };

  const remove = (s: Service) => {
    Alert.alert('מחיקת שירות', `למחוק את "${s.name}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחיקה', style: 'destructive', onPress: async () => { await deleteService(s.id); await load(); } },
    ]);
  };

  if (!branchId) return <View style={styles.container}><Text style={styles.emptyText}>יש ליצור סניף קודם.</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={services}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.label}>שם השירות</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="תספורת" placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>משך (דקות)</Text>
            <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
            <Text style={styles.label}>מחיר (₪)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="80" placeholderTextColor={colors.textMuted} />
            <View style={styles.switchRow}>
              <Text style={styles.label}>דורש מקדמה להזמנה</Text>
              <Switch value={requiresDeposit} onValueChange={setRequiresDeposit} />
            </View>
            {requiresDeposit && (
              <>
                <Text style={styles.label}>סכום המקדמה (₪)</Text>
                <TextInput style={styles.input} value={depositAmount} onChangeText={setDepositAmount} keyboardType="number-pad" />
              </>
            )}
            <TouchableOpacity style={styles.btn} onPress={save}>
              <Text style={styles.btnText}>הוספת שירות</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.durationMinutes} דק' · ₪{item.price}{item.requiresDeposit ? ` · מקדמה ₪${item.depositAmount}` : ''}</Text>
            </View>
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
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    btn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16, marginBottom: 8 },
    btnText: { color: '#fff', fontWeight: '700' },
    card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'center' },
    cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
    cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    delete: { fontSize: 18, paddingHorizontal: 8 },
  });
}
