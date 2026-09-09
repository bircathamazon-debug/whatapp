import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, Switch } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getStaffByBranch, addStaff, deleteStaff, updateStaff, emptyWeeklyHours } from '../../lib/staff';
import type { Staff } from '../../../shared/types';

export default function StaffScreen() {
  const { branchId } = useBranch();
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
    Alert.alert('Eliminar peluquero', `¿Eliminar a ${s.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteStaff(s.id); await load(); } },
    ]);
  };

  if (!branchId) return <View style={styles.container}><Text style={styles.emptyText}>Crea primero una sucursal.</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={staff}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="David" placeholderTextColor="#aaa" />
            <Text style={styles.label}>Teléfono (recibirá avisos de nuevas citas)</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+972501234567" placeholderTextColor="#aaa" keyboardType="phone-pad" />
            <TouchableOpacity style={styles.btn} onPress={save}>
              <Text style={styles.btnText}>Agregar peluquero</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40 },
  form: { marginBottom: 8 },
  label: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#1a3c5e' },
  btn: { backgroundColor: '#1a3c5e', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16, marginBottom: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'center', gap: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a3c5e' },
  cardMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  delete: { fontSize: 18, paddingHorizontal: 4 },
});
