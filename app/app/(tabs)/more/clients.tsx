import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TextInput, Pressable } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { getClientsByBranch, updateClientNotes, updateClientPreferredChannel } from '../../../lib/clients';
import { getAppointmentsByClientPhone } from '../../../lib/appointments';
import { getServicesByBranch } from '../../../lib/services';
import { useTheme, type ThemeColors, RADIUS, cardShadow, accentBorder, PRESSED_SCALE } from '../../../lib/theme';
import { useT, useDateLocale } from '../../../lib/i18n';
import { LOYALTY_THRESHOLD } from '../../../../shared/types';
import type { Client, Appointment, Service } from '../../../../shared/types';

export default function ClientsScreen() {
  const { branchId } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const dateLocale = useDateLocale();
  const styles = makeStyles(colors, mode);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const [clientList, serviceList] = await Promise.all([getClientsByBranch(branchId), getServicesByBranch(branchId)]);
      setClients(clientList);
      setServices(serviceList);
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

  const onSavedNotes = (clientId: string, notes: string) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, notes } : c)));
  };

  const onChannelChanged = (clientId: string, preferredChannel: Client['preferredChannel']) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, preferredChannel } : c)));
  };

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
          <ClientCard
            client={item}
            services={services}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onSavedNotes={(notes) => onSavedNotes(item.id, notes)}
            onChannelChanged={(channel) => onChannelChanged(item.id, channel)}
            styles={styles}
            colors={colors}
            t={t}
            dateLocale={dateLocale}
          />
        )}
      />
    </View>
  );
}

function ClientCard({
  client,
  services,
  expanded,
  onToggle,
  onSavedNotes,
  onChannelChanged,
  styles,
  colors,
  t,
  dateLocale,
}: {
  client: Client;
  services: Service[];
  expanded: boolean;
  onToggle: () => void;
  onSavedNotes: (notes: string) => void;
  onChannelChanged: (channel: Client['preferredChannel']) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  t: ReturnType<typeof useT>;
  dateLocale: string;
}) {
  const [notes, setNotes] = useState(client.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [history, setHistory] = useState<Appointment[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [changingChannel, setChangingChannel] = useState(false);

  useEffect(() => { setNotes(client.notes ?? ''); }, [client.notes]);

  useEffect(() => {
    if (!expanded || history !== null) return;
    setLoadingHistory(true);
    getAppointmentsByClientPhone(client.phone)
      .then(setHistory)
      .finally(() => setLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;
  const priceById = new Map(services.map((s) => [s.id, s.price]));
  const statusLabel = (status: Appointment['status']): string => {
    switch (status) {
      case 'confirmed': return t.agenda.statusConfirmed;
      case 'pending_deposit': return t.agenda.statusPending;
      case 'cancelled': return t.agenda.statusCancelled;
      case 'completed': return t.agenda.statusCompleted;
      case 'no_show': return t.agenda.statusNoShow;
    }
  };
  const statusColor = (status: Appointment['status']): string => {
    switch (status) {
      case 'confirmed': return colors.statusConfirmed;
      case 'pending_deposit': return colors.statusPending;
      case 'completed': return colors.statusCompleted;
      case 'cancelled': return colors.statusCancelled;
      case 'no_show': return colors.statusNoShow;
    }
  };
  const totalSpent = (history ?? []).filter((a) => a.status === 'completed').reduce((sum, a) => sum + (priceById.get(a.serviceId) ?? 0), 0);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await updateClientNotes(client.id, notes.trim());
      onSavedNotes(notes.trim());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const selectChannel = async (channel: Client['preferredChannel']) => {
    if (channel === client.preferredChannel || changingChannel) return;
    setChangingChannel(true);
    try {
      await updateClientPreferredChannel(client.id, channel);
      onChannelChanged(channel);
    } finally {
      setChangingChannel(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable style={({ pressed }) => pressed && PRESSED_SCALE} onPress={onToggle}>
        <View style={styles.rowBetween}>
          <Text style={styles.name}>{client.name}</Text>
          {client.blockedForDeposit && <Text style={styles.warnBadge}>{t.clients.requiresDeposit}</Text>}
        </View>
        <Text style={styles.phone}>{client.phone}</Text>
        <View style={styles.statsRow}>
          <Text style={styles.stat}>{t.clients.haircuts(client.completedCount, client.completedCount % LOYALTY_THRESHOLD, LOYALTY_THRESHOLD)}</Text>
          {client.noShowCount > 0 && <Text style={[styles.stat, styles.noShow]}>{t.clients.noShows(client.noShowCount)}</Text>}
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.expanded}>
          <Text style={styles.fieldLabel}>{t.clients.reminderChannelLabel}</Text>
          <View style={styles.channelRow}>
            {(['whatsapp', 'call'] as const).map((channel) => {
              const active = (client.preferredChannel ?? 'whatsapp') === channel;
              return (
                <Pressable
                  key={channel}
                  style={({ pressed }) => [styles.channelPill, active && styles.channelPillActive, pressed && PRESSED_SCALE]}
                  disabled={changingChannel}
                  onPress={() => selectChannel(channel)}
                >
                  <Text style={[styles.channelPillText, active && styles.channelPillTextActive]}>
                    {channel === 'whatsapp' ? t.clients.channelWhatsapp : t.clients.channelCall}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t.clients.notesLabel}</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.clients.notesPlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Pressable style={({ pressed }) => [styles.saveBtn, pressed && PRESSED_SCALE]} disabled={saving} onPress={saveNotes}>
            <Text style={styles.saveBtnText}>{justSaved ? t.clients.notesSaved : t.clients.saveNotes}</Text>
          </Pressable>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t.clients.historyTitle}</Text>
          {loadingHistory ? null : (history ?? []).length === 0 ? (
            <Text style={styles.hint}>{t.clients.noHistory}</Text>
          ) : (
            <>
              <Text style={styles.totalSpentText}>{t.clients.totalSpent(totalSpent)}</Text>
              {(history ?? []).map((a) => (
                <View key={a.id} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(a.startsAt)}</Text>
                  <Text style={styles.historyService}>{serviceName(a.serviceId)}</Text>
                  <Text style={[styles.historyStatus, { color: statusColor(a.status) }]}>{statusLabel(a.status)}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
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
    expanded: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
    fieldLabel: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
    channelRow: { flexDirection: 'row', gap: 8 },
    channelPill: { flex: 1, borderRadius: RADIUS.pill, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.surfaceMuted },
    channelPillActive: { backgroundColor: colors.accent },
    channelPillText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
    channelPillTextActive: { color: '#fff' },
    notesInput: { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.md, padding: 10, fontSize: 13, color: colors.text, minHeight: 70, textAlignVertical: 'top' },
    saveBtn: { backgroundColor: colors.accent, borderRadius: RADIUS.md, padding: 10, alignItems: 'center', marginTop: 8 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    hint: { fontSize: 12, color: colors.textMuted },
    totalSpentText: { fontSize: 13, fontWeight: '700', color: colors.accent, marginBottom: 6 },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
    historyDate: { fontSize: 11.5, color: colors.textMuted, width: 72 },
    historyService: { fontSize: 12, color: colors.text, flex: 1 },
    historyStatus: { fontSize: 11, fontWeight: '700' },
  });
}
