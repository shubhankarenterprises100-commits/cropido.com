import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { api } from '@/src/api/client';
import { Colors, Radius } from '@/src/theme';

export default function Forgot() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    setLoading(true);
    try {
      const r = await api.forgot(email.trim());
      setMsg(`${r.message}${r.dev_code ? ` (Dev code: ${r.dev_code})` : ''}`);
    } catch (e: any) {
      setMsg(e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="forgot-back">
        <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <View style={{ padding: 24 }}>
        <View style={styles.iconWrap}>
          <Ionicons name="key" size={28} color={Colors.secondary} />
        </View>
        <Text style={styles.title}>{t('auth.forgotTitle')}</Text>
        <Text style={styles.sub}>{t('auth.forgotSub')}</Text>

        <View style={styles.field}>
          <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            placeholder={t('common.email')}
            placeholderTextColor={Colors.textTertiary}
            value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address"
            style={styles.input}
            testID="forgot-email-input"
          />
        </View>
        {msg ? <Text style={styles.msg} testID="forgot-message">{msg}</Text> : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={loading} testID="forgot-submit">
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('auth.sendCode')}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSubtle, marginLeft: 20, marginTop: 12 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.secondary50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: Colors.textSecondary, marginTop: 6 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 4,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary },
  msg: { color: Colors.primary, marginTop: 12, fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    marginTop: 16, backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
