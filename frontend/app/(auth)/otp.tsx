import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import { api } from '@/src/api/client';
import { Colors, Radius } from '@/src/theme';

export default function OtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setUserSession } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async () => {
    setError('');
    if (phone.length < 6) return setError('Enter valid phone');
    setLoading(true);
    try {
      await api.sendOtp(phone);
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const verify = async () => {
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.verifyOtp({ phone, otp, name: 'Farmer' });
      await setUserSession(token, user);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="otp-back">
        <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <View style={{ padding: 24 }}>
        <View style={styles.iconWrap}>
          <Ionicons name="phone-portrait" size={28} color={Colors.primary} />
        </View>
        <Text style={styles.title}>{t('auth.otpTitle')}</Text>
        <Text style={styles.sub}>{sent ? `${t('auth.otpSub')} ${phone}` : 'Enter your mobile number'}</Text>
        <Text style={styles.demo}>{t('auth.otpUseDemo')}</Text>

        {!sent ? (
          <>
            <View style={styles.field}>
              <Text style={styles.cc}>+91</Text>
              <TextInput
                placeholder="Phone number"
                placeholderTextColor={Colors.textTertiary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.input}
                testID="otp-phone-input"
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={sendOtp} disabled={loading} testID="otp-send-button">
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Ionicons name="keypad-outline" size={18} color={Colors.textTertiary} />
              <TextInput
                placeholder="6-digit OTP"
                placeholderTextColor={Colors.textTertiary}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
                testID="otp-code-input"
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={verify} disabled={loading} testID="otp-verify-button">
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('auth.verify')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSent(false); setOtp(''); }} style={{ alignSelf: 'center', marginTop: 16 }}>
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>Change number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSubtle, marginLeft: 20, marginTop: 12 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: Colors.textSecondary, marginTop: 6 },
  demo: { fontSize: 13, color: Colors.secondary, marginTop: 8, fontWeight: '600' },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 4,
  },
  cc: { fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary },
  error: { color: Colors.error, marginTop: 8, fontSize: 13 },
  primaryBtn: {
    marginTop: 16, backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
