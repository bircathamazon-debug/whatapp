import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { getContact } from '../../lib/contacts';
import { DEFAULT_CATEGORIES, DEFAULT_ZONES } from '../../../shared/types';
import type { Contact } from '../../../shared/types';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getContact(id).then((c) => {
      setContact(c);
      if (c) navigation.setOptions({ title: c.name });
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return <ActivityIndicator style={styles.loader} color="#1a3c5e" size="large" />;
  }

  if (!contact) {
    return (
      <View style={styles.loader}>
        <Text style={styles.notFound}>איש קשר לא נמצא</Text>
      </View>
    );
  }

  const category = DEFAULT_CATEGORIES.find((c) => c.id === contact.category);
  const zone = DEFAULT_ZONES.find((z) => z.id === contact.zone);

  const openWhatsApp = () => {
    const phone = contact.phone.replace(/\D/g, '');
    const intl = phone.startsWith('0') ? `972${phone.slice(1)}` : phone;
    Linking.openURL(`https://wa.me/${intl}`);
  };

  const callPhone = () => {
    Linking.openURL(`tel:${contact.phone}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header card */}
      <View style={styles.headerCard}>
        <Text style={styles.icon}>{category?.icon ?? '📋'}</Text>
        <Text style={styles.name}>{contact.name}</Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{category?.labelHe ?? contact.category}</Text>
          </View>
          <View style={[styles.badge, styles.zoneBadge]}>
            <Text style={styles.badgeText}>{zone?.labelHe ?? contact.zone}</Text>
          </View>
        </View>
      </View>

      {/* Review */}
      {contact.review ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>המלצה</Text>
          <Text style={styles.reviewText}>{contact.review}</Text>
          <Text style={styles.recommendedBy}>— {contact.recommendedBy}</Text>
        </View>
      ) : null}

      {/* Phone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>טלפון</Text>
        <Text style={styles.phone}>{contact.phone}</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.waButton} onPress={openWhatsApp}>
          <Text style={styles.waButtonText}>💬  שלח הודעה ב-WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.callButton} onPress={callPhone}>
          <Text style={styles.callButtonText}>📞  התקשר</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.date}>
        נוסף בתאריך:{' '}
        {contact.createdAt.toLocaleDateString('he-IL', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontSize: 16, color: '#888' },

  headerCard: {
    backgroundColor: '#1a3c5e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 48, marginBottom: 8 },
  name: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
  badges: { flexDirection: 'row', gap: 8, marginTop: 8 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  zoneBadge: { backgroundColor: 'rgba(45,122,79,0.6)' },
  badgeText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewText: { fontSize: 15, color: '#333', textAlign: 'right', lineHeight: 22 },
  recommendedBy: { fontSize: 12, color: '#888', textAlign: 'right', marginTop: 8 },
  phone: { fontSize: 20, color: '#1a3c5e', fontWeight: '700', textAlign: 'right' },

  actions: { gap: 10, marginBottom: 16 },
  waButton: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  waButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  callButton: {
    backgroundColor: '#1a3c5e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  callButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  date: { fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 8 },
});
