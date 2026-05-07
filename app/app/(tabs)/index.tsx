import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import ContactCard from '../../components/ContactCard';
import FilterChips from '../../components/FilterChips';
import SearchBar from '../../components/SearchBar';
import EmptyState from '../../components/EmptyState';
import { getContacts, searchContacts } from '../../lib/contacts';
import type { Contact } from '../../../shared/types';

export default function HomeScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filtered, setFiltered] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [zone, setZone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getContacts({ category: category ?? undefined, zone: zone ?? undefined });
      setContacts(data);
      setFiltered(data);
    } finally {
      setLoading(false);
    }
  }, [category, zone]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!searchTerm) {
      setFiltered(contacts);
      return;
    }
    const t = searchTerm.toLowerCase();
    setFiltered(
      contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(t) ||
          c.review.toLowerCase().includes(t) ||
          c.phone.includes(t)
      )
    );
  }, [searchTerm, contacts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <SearchBar value={searchTerm} onChangeText={setSearchTerm} />
      <FilterChips
        selectedCategory={category}
        selectedZone={zone}
        onSelectCategory={setCategory}
        onSelectZone={setZone}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContactCard contact={item} />}
        ListEmptyComponent={
          loading ? null : <EmptyState message="לא נמצאו אנשי קשר" />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyList : styles.list}
      />

      {/* Admin button */}
      <TouchableOpacity
        style={styles.adminBtn}
        onPress={() => router.push('/admin')}
      >
        <Text style={styles.adminBtnText}>⚙️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { paddingVertical: 8 },
  emptyList: { flex: 1 },
  adminBtn: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    backgroundColor: '#1a3c5e',
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  adminBtnText: { fontSize: 24 },
});
