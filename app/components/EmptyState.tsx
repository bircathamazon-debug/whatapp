import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  message?: string;
}

export default function EmptyState({ message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔍</Text>
      <Text style={styles.text}>{message ?? 'לא נמצאו תוצאות'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  text: { fontSize: 16, color: '#888', textAlign: 'center' },
});
