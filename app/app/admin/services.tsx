import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, Switch } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getServicesByBranch, addService, deleteService } from '../../lib/services';
import type { Service } from '../../../shared/types';

export default function ServicesScreen() {
  const { branchId } = useBranch();
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
    Alert.alert('Eliminar servicio', `¿Eliminar "${s.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteService(s.id); await load(); } },
    ]);
  };

  if (!branchId) return <View style={styles.container}><Text style={styles.emptyText}>Crea primero una sucursal.</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={services}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.label}>Nombre del servicio</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Corte de cabello" placeholderTextColor="#aaa" />
            <Text style={styles.label}>Duración (minutos)</Text>
            <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
            <Text style={styles.label}>Precio (₪)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="80" placeholderTextColor="#aaa" />
            <View style={styles.switchRow}>
              <Text style={styles.label}>Exige depósito para reservar</Text>
              <Switch value={requiresDeposit} onValueChange={setRequiresDeposit} />
            </View>
            {requiresDeposit && (
              <>
                <Text style={styles.label}>Monto del depósito (₪)</Text>
                <TextInput style={styles.input} value={depositAmount} onChangeText={setDepositAmount} keyboardType="number-pad" />
              </>
            )}
            <TouchableOpacity style={styles.btn} onPress={save}>
              <Text style={styles.btnText}>Agregar servicio</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.durationMinutes} min · ₪{item.price}{item.requiresDeposit ? ` · depósito ₪${item.depositAmount}` : ''}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40 },
  form: { marginBottom: 8 },
  label: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#1a3c5e' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  btn: { backgroundColor: '#1a3c5e', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16, marginBottom: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a3c5e' },
  cardMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  delete: { fontSize: 18, paddingHorizontal: 8 },
});
