import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { getAuditLog } from '../../../lib/auditLog';
import { useTheme, type ThemeColors, RADIUS, cardShadow, accentBorder } from '../../../lib/theme';
import { useT, useDateLocale } from '../../../lib/i18n';
import type { AuditLogEntry } from '../../../../shared/types';

export default function AuditLogScreen() {
  const { branchId } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const dateLocale = useDateLocale();
  const styles = makeStyles(colors, mode);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      setEntries(await getAuditLog(branchId));
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

  const formatWhen = (ms: number) =>
    new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ms);

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>{t.auditLog.empty}</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.action}>{t.auditLog.action[item.action] ?? item.action}</Text>
              <Text style={styles.when}>{formatWhen(item.createdAt)}</Text>
            </View>
            <Text style={styles.who}>{item.email}</Text>
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
    action: { fontSize: 15, fontWeight: '700', color: colors.text },
    when: { fontSize: 12, color: colors.textMuted },
    who: { fontSize: 13, color: colors.textMuted, marginTop: 6 },
  });
}
