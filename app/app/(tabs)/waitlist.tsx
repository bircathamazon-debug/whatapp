import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getActiveWaitlist } from '../../lib/waitlist';
import type { WaitlistEntry } from '../../../shared/types';

const STATUS_LABEL: Record<string, string> = { waiting: 'Esperando', offered: 'Turno ofrecido' };

export default function WaitlistScreen() {
  const { branchId } = useBranch();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      setEntries(await getActiveWaitlist(branchId));
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

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>Nadie en lista de espera. Cuando un cliente no encuentra hueco por WhatsApp, aparecerá aquí y se le avisará automáticamente si se libera un turno.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.clientName}</Text>
              <Text style={styles.badge}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
            <Text style={styles.meta}>{item.clientPhone} · quiere el {item.desiredDate}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 12 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: '#1a3c5e' },
  badge: { fontSize: 11, color: '#b7791f', fontWeight: '700' },
  meta: { fontSize: 13, color: '#666', marginTop: 4 },
});
