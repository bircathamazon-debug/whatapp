import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const MENU = [
  { icon: '🏢', label: 'Sucursales', route: '/admin/branches' as const },
  { icon: '💈', label: 'Peluqueros', route: '/admin/staff' as const },
  { icon: '💇', label: 'Servicios', route: '/admin/services' as const },
  { icon: '🗓️', label: 'Horarios y días bloqueados', route: '/admin/schedule' as const },
  { icon: '⚙️', label: 'Configuración (depósitos, Shabat, Google Calendar)', route: '/admin/settings' as const },
];

export default function AdminIndexScreen() {
  const router = useRouter();

  const logout = async () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await signOut(auth); router.replace('/admin/login'); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panel del peluquero</Text>

      {MENU.map((item) => (
        <TouchableOpacity key={item.route} style={styles.menuItem} onPress={() => router.push(item.route)}>
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuText}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout}>
        <Text style={styles.menuIcon}>🚪</Text>
        <Text style={[styles.menuText, styles.logoutText]}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a3c5e', marginBottom: 20, marginTop: 8 },
  menuItem: {
    flexDirection: 'row',
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
  menuText: { fontSize: 15, color: '#1a3c5e', fontWeight: '600', flex: 1 },
  logoutText: { color: '#e53e3e' },
});
