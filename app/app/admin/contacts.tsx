import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  getPendingContacts,
  updateContact,
  deleteContact,
} from '../../lib/contacts';
import { DEFAULT_CATEGORIES, DEFAULT_ZONES } from '../../../shared/types';
import type { Contact } from '../../../shared/types';

export default function AdminContactsScreen() {
  const [pending, setPending] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<Partial<Contact>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setPending(await getPendingContacts());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const approve = async (contact: Contact) => {
    await updateContact(contact.id, { ...form, approved: true });
    await load();
  };

  const remove = (contact: Contact) => {
    Alert.alert('מחיקה', `למחוק את ${contact.name}?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחיקה',
        style: 'destructive',
        onPress: async () => {
          await deleteContact(contact.id);
          await load();
        },
      },
    ]);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setForm({
      name: contact.name,
      phone: contact.phone,
      category: contact.category,
      zone: contact.zone,
      review: contact.review,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await updateContact(editing.id, form);
    setEditing(null);
    await load();
  };

  const renderItem = ({ item }: { item: Contact }) => {
    const cat = DEFAULT_CATEGORIES.find((c) => c.id === item.category);
    const zone = DEFAULT_ZONES.find((z) => z.id === item.zone);
    return (
      <View style={styles.card}>
        <Text style={styles.cardName}>{cat?.icon} {item.name}</Text>
        <Text style={styles.cardMeta}>{cat?.labelHe} · {zone?.labelHe}</Text>
        <Text style={styles.cardPhone}>{item.phone}</Text>
        {item.review ? (
          <Text style={styles.cardReview} numberOfLines={2}>{item.review}</Text>
        ) : null}
        <Text style={styles.cardFrom}>ממליץ: {item.recommendedBy}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.approveBtn} onPress={() => approve(item)}>
            <Text style={styles.approveBtnText}>✅ אשר</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
            <Text style={styles.editBtnText}>✏️ ערוך</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => remove(item)}>
            <Text style={styles.deleteBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pending}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>אין אנשי קשר ממתינים לאישור 🎉</Text>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
      />

      {/* Edit modal */}
      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>עריכת איש קשר</Text>
          {(['name', 'phone', 'review'] as const).map((field) => (
            <TextInput
              key={field}
              style={styles.modalInput}
              value={form[field] as string}
              onChangeText={(v) => setForm((f) => ({ ...f, [field]: v }))}
              placeholder={field === 'name' ? 'שם' : field === 'phone' ? 'טלפון' : 'המלצה'}
              placeholderTextColor="#aaa"
              textAlign="right"
              multiline={field === 'review'}
            />
          ))}

          <Text style={styles.modalLabel}>קטגוריה</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {DEFAULT_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, form.category === c.id && styles.chipActive]}
                onPress={() => setForm((f) => ({ ...f, category: c.id }))}
              >
                <Text style={[styles.chipText, form.category === c.id && styles.chipTextActive]}>
                  {c.icon} {c.labelHe}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.modalLabel}>אזור</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {DEFAULT_ZONES.map((z) => (
              <TouchableOpacity
                key={z.id}
                style={[styles.chip, form.zone === z.id && styles.chipActive]}
                onPress={() => setForm((f) => ({ ...f, zone: z.id }))}
              >
                <Text style={[styles.chipText, form.zone === z.id && styles.chipTextActive]}>
                  {z.labelHe}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
            <Text style={styles.saveBtnText}>שמור שינויים</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
            <Text style={styles.cancelBtnText}>ביטול</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 16 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardName: { fontSize: 17, fontWeight: '700', color: '#1a3c5e', textAlign: 'right' },
  cardMeta: { fontSize: 12, color: '#888', textAlign: 'right', marginTop: 2 },
  cardPhone: { fontSize: 15, color: '#333', textAlign: 'right', marginTop: 4 },
  cardReview: { fontSize: 13, color: '#555', textAlign: 'right', marginTop: 6, lineHeight: 18 },
  cardFrom: { fontSize: 11, color: '#aaa', textAlign: 'right', marginTop: 4 },
  cardActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 12,
  },
  approveBtn: { backgroundColor: '#e6f4ea', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  approveBtnText: { color: '#2d7a4f', fontWeight: '600', fontSize: 13 },
  editBtn: { backgroundColor: '#e8f0fe', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  editBtnText: { color: '#1a3c5e', fontWeight: '600', fontSize: 13 },
  deleteBtn: { backgroundColor: '#fff5f5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  deleteBtnText: { fontSize: 16 },

  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalContent: { padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1a3c5e', textAlign: 'right', marginBottom: 20 },
  modalInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#1a3c5e',
    textAlign: 'right',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalLabel: { fontSize: 12, color: '#888', textAlign: 'right', fontWeight: '600', marginBottom: 8 },
  chipRow: { marginBottom: 16 },
  chip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  chipActive: { backgroundColor: '#1a3c5e' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#1a3c5e', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#555', fontSize: 15 },
});
