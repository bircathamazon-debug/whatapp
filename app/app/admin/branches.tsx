import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { addBranch, deleteBranch } from '../../lib/branches';

export default function BranchesScreen() {
  const { branches, reload } = useBranch();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [geonameId, setGeonameId] = useState('293397'); // Jerusalem por defecto (Hebcal geonameid)
  const [phone, setPhone] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    await addBranch({
      name: name.trim(),
      address: address.trim(),
      geonameId: geonameId.trim(),
      timezone: 'Asia/Jerusalem',
      shabbatMode: 'silent',
      phone: phone.trim(),
    });
    setName('');
    setAddress('');
    setPhone('');
    await reload();
  };

  const remove = (id: string, label: string) => {
    Alert.alert('Eliminar sucursal', `¿Eliminar "${label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await deleteBranch(id); await reload(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={branches}
        keyExtractor={(b) => b.id}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Peluquería Central" placeholderTextColor="#aaa" />
            <Text style={styles.label}>Dirección</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Calle, ciudad" placeholderTextColor="#aaa" />
            <Text style={styles.label}>Teléfono (para el IVR / transferencia)</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+972501234567" placeholderTextColor="#aaa" keyboardType="phone-pad" />
            <Text style={styles.label}>Geoname ID (Hebcal, para horarios de Shabat)</Text>
            <TextInput style={styles.input} value={geonameId} onChangeText={setGeonameId} placeholder="293397" placeholderTextColor="#aaa" />
            <TouchableOpacity style={styles.btn} onPress={save}>
              <Text style={styles.btnText}>Agregar sucursal</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>Sucursales existentes</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.address}</Text>
              <Text style={styles.cardMeta}>Modo Shabat: {item.shabbatMode}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(item.id, item.name)}>
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
  form: { marginBottom: 8 },
  label: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', color: '#1a3c5e' },
  btn: { backgroundColor: '#1a3c5e', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a3c5e', marginTop: 24, marginBottom: 8 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a3c5e' },
  cardMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  delete: { fontSize: 18, paddingHorizontal: 8 },
});
