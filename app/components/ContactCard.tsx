import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_CATEGORIES, DEFAULT_ZONES } from '../../shared/types';
import type { Contact } from '../../shared/types';

interface Props {
  contact: Contact;
}

export default function ContactCard({ contact }: Props) {
  const router = useRouter();

  const category = DEFAULT_CATEGORIES.find((c) => c.id === contact.category);
  const zone = DEFAULT_ZONES.find((z) => z.id === contact.zone);

  const openWhatsApp = () => {
    const phone = contact.phone.replace(/\D/g, '');
    const intl = phone.startsWith('0') ? `972${phone.slice(1)}` : phone;
    Linking.openURL(`https://wa.me/${intl}`);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/contact/${contact.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>{category?.icon ?? '📋'}</Text>
        <View style={styles.titleBlock}>
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
        <TouchableOpacity style={styles.waBtn} onPress={openWhatsApp}>
          <Text style={styles.waBtnText}>💬</Text>
        </TouchableOpacity>
      </View>

      {contact.review ? (
        <Text style={styles.review} numberOfLines={2}>
          {contact.review}
        </Text>
      ) : null}

      <Text style={styles.recommended}>המלצה מאת: {contact.recommendedBy}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: { fontSize: 28, marginLeft: 10 },
  titleBlock: { flex: 1, alignItems: 'flex-end' },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a3c5e',
    textAlign: 'right',
  },
  badges: {
    flexDirection: 'row-reverse',
    marginTop: 4,
    gap: 6,
  },
  badge: {
    backgroundColor: '#e8f0fe',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  zoneBadge: { backgroundColor: '#e6f4ea' },
  badgeText: { fontSize: 11, color: '#1a3c5e', fontWeight: '600' },
  waBtn: {
    backgroundColor: '#25D366',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waBtnText: { fontSize: 20 },
  review: {
    fontSize: 13,
    color: '#555',
    textAlign: 'right',
    lineHeight: 19,
    marginBottom: 6,
  },
  recommended: {
    fontSize: 11,
    color: '#888',
    textAlign: 'right',
  },
});
