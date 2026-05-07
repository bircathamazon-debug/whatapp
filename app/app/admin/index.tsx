import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export default function AdminIndexScreen() {
  const router = useRouter();

  const logout = async () => {
    await signOut(auth);
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>פאנל ניהול</Text>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('/admin/contacts')}
      >
        <Text style={styles.menuIcon}>✅</Text>
        <Text style={styles.menuText}>אישור אנשי קשר ממתינים</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout}>
        <Text style={styles.menuIcon}>🚪</Text>
        <Text style={[styles.menuText, styles.logoutText]}>התנתקות</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a3c5e',
    textAlign: 'right',
    marginBottom: 20,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  logoutItem: { backgroundColor: '#fff5f5' },
  menuIcon: { fontSize: 22 },
  menuText: { fontSize: 16, color: '#1a3c5e', fontWeight: '600' },
  logoutText: { color: '#e53e3e' },
});
