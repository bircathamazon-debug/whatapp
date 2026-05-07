import React, { useState, useEffect } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import SearchBar from '../../components/SearchBar';
import ContactCard from '../../components/ContactCard';
import EmptyState from '../../components/EmptyState';
import { searchContacts } from '../../lib/contacts';
import type { Contact } from '../../../shared/types';

export default function SearchScreen() {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchContacts(term.trim());
        setResults(data);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [term]);

  return (
    <View style={styles.container}>
      <SearchBar
        value={term}
        onChangeText={setTerm}
        placeholder="חפש לפי שם, מקצוע, עיר..."
      />

      {loading && (
        <ActivityIndicator style={styles.loader} color="#1a3c5e" size="large" />
      )}

      {!loading && searched && results.length === 0 && (
        <EmptyState message={`לא נמצאו תוצאות עבור "${term}"`} />
      )}

      {!loading && !searched && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>הקלד לפחות 2 תווים לחיפוש</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContactCard contact={item} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loader: { marginTop: 40 },
  hint: { alignItems: 'center', marginTop: 40 },
  hintText: { color: '#aaa', fontSize: 14 },
  list: { paddingVertical: 8 },
});
