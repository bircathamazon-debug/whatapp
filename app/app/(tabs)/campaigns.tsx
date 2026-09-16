import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { broadcastEmptySlots } from '../../lib/campaigns';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { useT } from '../../lib/i18n';

export default function CampaignsScreen() {
  const { branchId } = useBranch();
  const { colors } = useTheme();
  const t = useT();
  const styles = makeStyles(colors);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const send = async () => {
    if (!branchId) return;
    setSending(true);
    try {
      const { sentTo, message } = await broadcastEmptySlots(branchId);
      setLastResult(sentTo > 0 ? t.campaigns.sentTo(sentTo, message) : message);
    } catch (err: any) {
      Alert.alert(t.campaigns.error, err.message ?? t.campaigns.errorGeneric);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.campaigns.title}</Text>
      <Text style={styles.subtitle}>{t.campaigns.subtitle}</Text>
      <TouchableOpacity style={styles.btn} onPress={send} disabled={sending || !branchId}>
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t.campaigns.send}</Text>}
      </TouchableOpacity>
      {lastResult && <Text style={styles.result}>{lastResult}</Text>}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
    title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 20 },
    btn: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    result: { marginTop: 16, color: colors.success, fontSize: 13, lineHeight: 18 },
  });
}
