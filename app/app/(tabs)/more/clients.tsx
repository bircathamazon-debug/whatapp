import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { getClientsByBranch } from '../../../lib/clients';
import { useTheme, type ThemeColors, RADIUS, cardShadow, accentBorder } from '../../../lib/theme';
import { useT } from '../../../lib/i18n';
import { LOYALTY_THRESHOLD } from '../../../../shared/types';
import type { Client } from '../../../../shared/types';

export default function ClientsScreen() {
  const { branchId } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const styles = makeStyles(colors, mode);
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
      <TextInput style={styles.search} placeholder={t.clients.searchPlaceholder} placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>{t.clients.empty}</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.name}</Text>
              {item.blockedForDeposit && <Text style={styles.warnBadge}>{t.clients.requiresDeposit}</Text>}
            </View>
            <Text style={styles.phone}>{item.phone}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>{t.clients.haircuts(item.completedCount, item.completedCount % LOYALTY_THRESHOLD, LOYALTY_THRESHOLD)}</Text>
              {item.noShowCount > 0 && <Text style={[styles.stat, styles.noShow]}>{t.clients.noShows(item.noShowCount)}</Text>}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    search: { backgroundColor: colors.surfaceMuted, margin: 12, borderRadius: RADIUS.md, padding: 12, color: colors.text },
    list: { padding: 12, paddingTop: 0 },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    card: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...cardShadow(mode, 'sm'), ...accentBorder(colors) },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    warnBadge: { fontSize: 11, color: colors.statusPending, fontWeight: '700' },
    phone: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    statsRow: { marginTop: 8, gap: 2 },
    stat: { fontSize: 12, color: colors.textMuted },
    noShow: { color: colors.danger },
  });
}
