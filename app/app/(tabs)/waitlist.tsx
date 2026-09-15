import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getActiveWaitlist } from '../../lib/waitlist';
import { useTheme, type ThemeColors } from '../../lib/theme';
import type { WaitlistEntry } from '../../../shared/types';

const STATUS_LABEL: Record<string, string> = { waiting: 'ממתין', offered: 'הוצע תור' };

export default function WaitlistScreen() {
  const { branchId } = useBranch();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>אין אף אחד ברשימת ההמתנה. כשלקוח לא מוצא תור פנוי בוואטסאפ, הוא יופיע כאן ויקבל הודעה אוטומטית אם יתפנה תור.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.clientName}</Text>
              <Text style={styles.badge}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
            <Text style={styles.meta}>{item.clientPhone} · רוצה ל-{item.desiredDate}</Text>
          </View>
        )}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    list: { padding: 12 },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
    card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    badge: { fontSize: 11, color: colors.statusPending, fontWeight: '700' },
    meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  });
}
