import React from 'react';
import { ScrollView } from 'react-native';
import ChangePasswordForm from '../../../components/ChangePasswordForm';
import { useTheme } from '../../../lib/theme';

export default function PasswordScreen() {
  const { colors } = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <ChangePasswordForm />
    </ScrollView>
  );
}
