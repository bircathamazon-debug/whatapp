import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getClientsByBranch } from '../../lib/clients';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { LOYALTY_THRESHOLD } from '../../../shared/types';
import type { Client } from '../../../shared/types';

export default function ClientsScreen() {
  const { branchId } = useBranch();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
      <TextInput style={styles.search} placeholder="חיפוש לפי שם או טלפון" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>אין עדיין לקוחות.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.name}</Text>
              {item.blockedForDeposit && <Text style={styles.warnBadge}>דורש מקדמה</Text>}
            </View>
            <Text style={styles.phone}>{item.phone}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>✂️ {item.completedCount} תספורות ({item.completedCount % LOYALTY_THRESHOLD}/{LOYALTY_THRESHOLD} לפרס הבא)</Text>
              {item.noShowCount > 0 && <Text style={[styles.stat, styles.noShow]}>⚠️ {item.noShowCount} אי-הגעות</Text>}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    search: { backgroundColor: colors.surface, margin: 12, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border, color: colors.text },
    list: { padding: 12, paddingTop: 0 },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    warnBadge: { fontSize: 11, color: colors.statusPending, fontWeight: '700' },
    phone: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    statsRow: { marginTop: 8, gap: 2 },
    stat: { fontSize: 12, color: colors.textMuted },
    noShow: { color: colors.danger },
  });
}
