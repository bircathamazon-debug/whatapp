import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, Alert, Switch } from 'react-native';
import { useBranch } from '../../../lib/branchContext';
import { getServicesByBranch, addService, updateService, deleteService } from '../../../lib/services';
import { useTheme, type ThemeColors, RADIUS, cardShadow, accentBorder, PRESSED_SCALE } from '../../../lib/theme';
import { useT } from '../../../lib/i18n';
import type { Service, ServiceVariant } from '../../../../shared/types';

function VariantsEditor({
  service,
  colors,
  styles,
  t,
  onChanged,
}: {
  service: Service;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  t: ReturnType<typeof useT>;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const variants = service.variants ?? [];

  const addVariant = async () => {
    if (!variantName.trim() || !variantPrice.trim()) return;
    const next: ServiceVariant[] = [
      ...variants,
      { id: `${Date.now()}`, name: variantName.trim(), price: Number(variantPrice) || 0 },
    ];
    await updateService(service.id, { variants: next });
    setVariantName('');
    setVariantPrice('');
    await onChanged();
  };

  const removeVariant = async (id: string) => {
    await updateService(service.id, { variants: variants.filter((v) => v.id !== id) });
    await onChanged();
  };

  return (
    <View style={styles.variantsBlock}>
      <Pressable onPress={() => setOpen((o) => !o)}>
        <Text style={styles.variantsToggle}>{open ? '▾' : '▸'} {t.services.variantsTitle}</Text>
      </Pressable>
      {open && (
        <View style={styles.variantsBody}>
          <Text style={styles.variantsHint}>{t.services.variantsHint}</Text>
          {variants.map((v) => (
            <View key={v.id} style={styles.variantRow}>
              <Text style={styles.variantRowText}>{v.name} — ₪{v.price}</Text>
              <Pressable style={({ pressed }) => pressed && PRESSED_SCALE} onPress={() => removeVariant(v.id)}>
                <Text style={styles.delete}>🗑️</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.variantAddRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={variantName}
              onChangeText={setVariantName}
              placeholder={t.services.variantNamePlaceholder}
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.input, { width: 70 }]}
              value={variantPrice}
              onChangeText={setVariantPrice}
              keyboardType="number-pad"
              placeholder={t.services.variantPricePlaceholder}
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={({ pressed }) => [styles.variantAddBtn, pressed && PRESSED_SCALE]} onPress={addVariant}>
              <Text style={styles.variantAddBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function ServicesScreen() {
  const { branchId } = useBranch();
  const { colors, mode } = useTheme();
  const t = useT();
  const styles = makeStyles(colors, mode);
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('');
  const [requiresDeposit, setRequiresDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('50');

  const load = useCallback(async () => {
    if (!branchId) return;
    setServices(await getServicesByBranch(branchId));
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!branchId || !name.trim()) return;
    await addService({
      branchId,
      name: name.trim(),
      durationMinutes: Number(duration) || 30,
      price: Number(price) || 0,
      requiresDeposit,
      depositAmount: Number(depositAmount) || 0,
    });
    setName('');
    setPrice('');
    await load();
  };

  const remove = (s: Service) => {
    Alert.alert(t.services.deleteTitle, t.services.deleteConfirm(s.name), [
      { text: t.services.cancel, style: 'cancel' },
      { text: t.services.delete, style: 'destructive', onPress: async () => { await deleteService(s.id); await load(); } },
    ]);
  };

  if (!branchId) return <View style={styles.container}><Text style={styles.emptyText}>{t.services.needBranch}</Text></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={services}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={styles.form}>
            <Text style={styles.label}>{t.services.name}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t.services.namePlaceholder} placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>{t.services.duration}</Text>
            <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
            <Text style={styles.label}>{t.services.price}</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="80" placeholderTextColor={colors.textMuted} />
            <View style={styles.switchRow}>
              <Text style={styles.label}>{t.services.requiresDeposit}</Text>
              <Switch value={requiresDeposit} onValueChange={setRequiresDeposit} />
            </View>
            {requiresDeposit && (
              <>
                <Text style={styles.label}>{t.services.depositAmount}</Text>
                <TextInput style={styles.input} value={depositAmount} onChangeText={setDepositAmount} keyboardType="number-pad" />
              </>
            )}
            <Pressable style={({ pressed }) => [styles.btn, pressed && PRESSED_SCALE]} onPress={save}>
              <Text style={styles.btnText}>{t.services.add}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {item.variants && item.variants.length > 0
                    ? t.services.metaWithVariants(item.durationMinutes)
                    : t.services.meta(item.durationMinutes, item.price, item.requiresDeposit ? item.depositAmount : undefined)}
                </Text>
              </View>
              <Pressable style={({ pressed }) => pressed && PRESSED_SCALE} onPress={() => remove(item)}>
                <Text style={styles.delete}>🗑️</Text>
              </Pressable>
            </View>
            <VariantsEditor service={item} colors={colors} styles={styles} t={t} onChanged={load} />
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors, mode: 'light' | 'dark') {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
    form: { marginBottom: 8 },
    label: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.md, padding: 12, color: colors.text },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    btn: { backgroundColor: colors.accent, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', marginTop: 16, marginBottom: 8 },
    btnText: { color: '#fff', fontWeight: '700' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: 14,
      marginBottom: 10,
      ...cardShadow(mode, 'sm'),
      ...accentBorder(colors),
    },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
    cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    delete: { fontSize: 18, paddingHorizontal: 8 },
    variantsBlock: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.surfaceMuted, paddingTop: 8 },
    variantsToggle: { fontSize: 13, fontWeight: '600', color: colors.accent },
    variantsBody: { marginTop: 8 },
    variantsHint: { fontSize: 11, color: colors.textMuted, marginBottom: 8 },
    variantRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: RADIUS.md,
      padding: 10,
      marginBottom: 6,
    },
    variantRowText: { fontSize: 13, color: colors.text },
    variantAddRow: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' },
    variantAddBtn: {
      backgroundColor: colors.accent,
      borderRadius: RADIUS.md,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    variantAddBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  });
}
