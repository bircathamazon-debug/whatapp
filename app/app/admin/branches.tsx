import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { useBranch } from '../../lib/branchContext';
import { addBranch, deleteBranch } from '../../lib/branches';
import { useTheme, type ThemeColors } from '../../lib/theme';
import { useT } from '../../lib/i18n';

export default function BranchesScreen() {
  const { branches, reload } = useBranch();
  const { colors } = useTheme();
  const t = useT();
  const SHABBAT_MODE_LABEL: Record<string, string> = { off: t.branches.shabbatOff, silent: t.branches.shabbatSilent, closed: t.branches.shabbatClosed };
  const styles = makeStyles(colors);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [geonameId, setGeonameId] = useState('293397'); // Jerusalén por defecto (geonameid de Hebcal)
  const [phone, setPhone] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    await addBranch({
      name: name.trim(),
      address: address.trim(),
      geonameId: geonameId.trim(),
      timezone: 'Asia/Jerusalem',
      shabbatMode: 'silent',
      phone: phone.trim(),
    });
    setName('');
    setAddress('');
    setPhone('');
    await reload();
  };

  const remove = (id: string, label: string) => {
    Alert.alert(t.branches.deleteTitle, t.branches.deleteConfirm(label), [
      { text: t.branches.cancel, style: 'cancel' },
      { text: t.branches.delete, style: 'destructive', onPress: async () => { await deleteBranch(id); await reload(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={branches}
        keyExtractor={(b) => b.id}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.label}>{t.branches.name}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t.branches.namePlaceholder} placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>{t.branches.address}</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder={t.branches.addressPlaceholder} placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>{t.branches.phone}</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+972501234567" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            <Text style={styles.label}>{t.branches.geonameId}</Text>
            <TextInput style={styles.input} value={geonameId} onChangeText={setGeonameId} placeholder="293397" placeholderTextColor={colors.textMuted} />
            <TouchableOpacity style={styles.btn} onPress={save}>
              <Text style={styles.btnText}>{t.branches.add}</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>{t.branches.existing}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.address}</Text>
              <Text style={styles.cardMeta}>{t.branches.shabbatModeLine(SHABBAT_MODE_LABEL[item.shabbatMode] ?? item.shabbatMode)}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(item.id, item.name)}>
              <Text style={styles.delete}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    form: { marginBottom: 8 },
    label: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border, color: colors.text },
    btn: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    btnText: { color: '#fff', fontWeight: '700' },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 24, marginBottom: 8 },
    card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'center' },
    cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
    cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    delete: { fontSize: 18, paddingHorizontal: 8 },
  });
}
