import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { getUnansweredByBranch, markMessageResolved, deleteUnansweredMessage } from '../../lib/unansweredMessages';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import type { UnansweredMessage } from '../../../shared/types';

export default function QuestionsScreen() {
  const { branchId } = useBranch();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const [messages, setMessages] = useState<UnansweredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      setMessages(await getUnansweredByBranch(branchId));
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

  const resolve = async (m: UnansweredMessage) => {
    await markMessageResolved(m.id);
    await load();
  };

  const remove = (m: UnansweredMessage) => {
    Alert.alert(t.questions.deleteTitle, t.questions.deleteConfirm, [
      { text: t.questions.cancel, style: 'cancel' },
      { text: t.questions.delete, style: 'destructive', onPress: async () => { await deleteUnansweredMessage(m.id); await load(); } },
    ]);
  };

  const pending = messages.filter((m) => !m.resolved);
  const resolved = messages.filter((m) => m.resolved);
  const sorted = [...pending, ...resolved];

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>{t.questions.empty}</Text> : null}
        renderItem={({ item }) => (
          <View style={[styles.card, item.resolved && styles.cardResolved]}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.clientName || t.questions.from(item.phone)}</Text>
              {item.resolved && <Text style={styles.badge}>{t.questions.resolved}</Text>}
            </View>
            <Text style={styles.text}>"{item.text}"</Text>
            <Text style={styles.meta}>{t.questions.from(item.phone)} · {t.questions.stepLabel(item.step)}</Text>
            <View style={styles.actionsRow}>
              {!item.resolved && (
                <TouchableOpacity style={styles.resolveBtn} onPress={() => resolve(item)}>
                  <Text style={styles.resolveBtnText}>{t.questions.resolve}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => remove(item)}>
                <Text style={styles.delete}>{t.questions.delete}</Text>
              </TouchableOpacity>
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
    list: { padding: 12 },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
    card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    cardResolved: { opacity: 0.55 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    badge: { fontSize: 11, color: colors.statusConfirmed, fontWeight: '700' },
    text: { fontSize: 14, color: colors.text, marginTop: 8, fontStyle: 'italic' },
    meta: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
    actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    resolveBtn: { backgroundColor: colors.accentSoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    resolveBtnText: { color: colors.accent, fontWeight: '700', fontSize: 12 },
    delete: { fontSize: 16, paddingHorizontal: 4 },
  });
}
