import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import { Colors, Radius, Spacing } from '@/src/theme';

const ROLES = ['farmer', 'buyer', 'seller', 'supplier', 'consultant'] as const;

export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<typeof ROLES[number]>('farmer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name || !email || password.length < 6) {
      setError('Please fill all fields (password ≥ 6 chars)');
      return;
    }
    setLoading(true);
    try {
      await register({ name, email: email.trim(), password, phone, role });
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="register-back">
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title} testID="register-title">{t('auth.signUp')}</Text>
          <Text style={styles.sub}>{t('auth.signUpSub')}</Text>

          <View style={{ marginTop: 24 }}>
            <View style={styles.field}>
              <Ionicons name="person-outline" size={18} color={Colors.textTertiary} />
              <TextInput placeholder={t('common.name')} placeholderTextColor={Colors.textTertiary}
                value={name} onChangeText={setName} style={styles.input} testID="register-name-input" />
            </View>
            <View style={styles.field}>
              <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />
              <TextInput placeholder={t('common.email')} placeholderTextColor={Colors.textTertiary}
                value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
                style={styles.input} testID="register-email-input" />
            </View>
            <View style={styles.field}>
              <Ionicons name="call-outline" size={18} color={Colors.textTertiary} />
              <TextInput placeholder={t('common.phone')} placeholderTextColor={Colors.textTertiary}
                value={phone} onChangeText={setPhone} keyboardType="phone-pad"
                style={styles.input} testID="register-phone-input" />
            </View>
            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} />
              <TextInput placeholder={t('common.password')} placeholderTextColor={Colors.textTertiary}
                value={password} onChangeText={setPassword} secureTextEntry
                style={styles.input} testID="register-password-input" />
            </View>

            <Text style={styles.label}>{t('auth.roleSelect')}</Text>
            <View style={styles.roleWrap}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.rolePill, role === r && styles.rolePillActive]}
                  testID={`register-role-${r}`}
                >
                  <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                    {t(`auth.roles.${r}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={loading} testID="register-submit-button">
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.primaryBtnText}>{t('common.register')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('auth.alreadyHaveAccount')} </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity><Text style={styles.footerLink}>{t('common.login')}</Text></TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSubtle, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.6 },
  sub: { fontSize: 15, color: Colors.textSecondary, marginTop: 6 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 12,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  roleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  rolePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  rolePillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  roleTextActive: { color: '#fff' },
  errorText: { color: Colors.error, fontSize: 13, marginVertical: 8 },
  primaryBtn: {
    marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
