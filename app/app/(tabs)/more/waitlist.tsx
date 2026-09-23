import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { getActiveWaitlist } from '../../../lib/waitlist';
import { useTheme, type ThemeColors, RADIUS, cardShadow, accentBorder } from '../../../lib/theme';
import { useT } from '../../../lib/i18n';
import type { WaitlistEntry } from '../../../../shared/types';

export default function WaitlistScreen() {
  const { branchId } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const STATUS_LABEL: Record<string, string> = { waiting: t.waitlist.statusWaiting, offered: t.waitlist.statusOffered };
  const styles = makeStyles(colors, mode);
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
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>{t.waitlist.empty}</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.clientName}</Text>
              <Text style={styles.badge}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
            <Text style={styles.meta}>{t.waitlist.wants(item.clientPhone, item.desiredDate)}</Text>
          </View>
        )}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    list: { padding: 12 },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
    card: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...cardShadow(mode, 'sm'), ...accentBorder(colors) },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    badge: { fontSize: 11, color: colors.statusPending, fontWeight: '700' },
    meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  });
}
