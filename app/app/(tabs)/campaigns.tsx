import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { broadcastEmptySlots } from '../../lib/campaigns';

export default function CampaignsScreen() {
  const { branchId } = useBranch();
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const send = async () => {
    if (!branchId) return;
    setSending(true);
    try {
      const { sentTo, message } = await broadcastEmptySlots(branchId);
      setLastResult(sentTo > 0 ? `Enviado a ${sentTo} clientes: "${message}"` : message);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo enviar la campaña.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Horas vacías de hoy</Text>
      <Text style={styles.subtitle}>
        Busca el próximo hueco libre de hoy y le avisa por WhatsApp a tus últimos 50 clientes de esta sucursal: "Hoy quedó libre un turno a las 16:30".
      </Text>
      <TouchableOpacity style={styles.btn} onPress={send} disabled={sending || !branchId}>
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enviar campaña ahora</Text>}
      </TouchableOpacity>
      {lastResult && <Text style={styles.result}>{lastResult}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a3c5e', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 20 },
  btn: { backgroundColor: '#1a3c5e', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  result: { marginTop: 16, color: '#2d7a4f', fontSize: 13, lineHeight: 18 },
});
