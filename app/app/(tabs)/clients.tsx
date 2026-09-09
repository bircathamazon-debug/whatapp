import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getClientsByBranch } from '../../lib/clients';
import { LOYALTY_THRESHOLD } from '../../../shared/types';
import type { Client } from '../../../shared/types';

export default function ClientsScreen() {
  const { branchId } = useBranch();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      setClients(await getClientsByBranch(branchId));
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  return (
    <View style={styles.container}>
      <TextInput style={styles.search} placeholder="Buscar por nombre o teléfono" placeholderTextColor="#aaa" value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>Sin clientes todavía.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.name}</Text>
              {item.blockedForDeposit && <Text style={styles.warnBadge}>Requiere depósito</Text>}
            </View>
            <Text style={styles.phone}>{item.phone}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>✂️ {item.completedCount} cortes ({item.completedCount % LOYALTY_THRESHOLD}/{LOYALTY_THRESHOLD} para el próximo premio)</Text>
              {item.noShowCount > 0 && <Text style={[styles.stat, styles.noShow]}>⚠️ {item.noShowCount} inasistencias</Text>}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  search: { backgroundColor: '#fff', margin: 12, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  list: { padding: 12, paddingTop: 0 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: '#1a3c5e' },
  warnBadge: { fontSize: 11, color: '#b7791f', fontWeight: '700' },
  phone: { fontSize: 13, color: '#666', marginTop: 2 },
  statsRow: { marginTop: 8, gap: 2 },
  stat: { fontSize: 12, color: '#555' },
  noShow: { color: '#e53e3e' },
});
