import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth } from '@/src/contexts/AuthContext';
import { api } from '@/src/api/client';
import { Colors, Radius, Spacing } from '@/src/theme';

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login, setUserSession } = useAuth();
  const [email, setEmail] = useState('demo@cropido.app');
  const [password, setPassword] = useState('demo1234');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async () => {
    try {
      setLoading(true);
      const redirect = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? window.location.origin + '/' : '/')
        : Linking.createURL('auth');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
      if (result.type === 'success' && result.url) {
        const hash = result.url.split('#')[1] || result.url.split('?')[1] || '';
        const params = new URLSearchParams(hash);
        const sid = params.get('session_id');
        if (sid) {
          const { token, user } = await api.googleSession(sid);
          await setUserSession(token, user);
          router.replace('/(tabs)/home');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <LinearGradient colors={[Colors.primary50, '#fff']} style={styles.heroWrap}>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                <Ionicons name="leaf" size={28} color="#fff" />
              </View>
              <Text style={styles.brandText}>Cropido</Text>
            </View>
            <Text style={styles.title} testID="login-title">{t('auth.signIn')}</Text>
            <Text style={styles.sub}>{t('auth.signInSub')}</Text>
          </LinearGradient>

          <View style={styles.form}>
            <View style={styles.field}>
              <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />
              <TextInput
                placeholder={t('common.email')}
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                testID="login-email-input"
              />
            </View>
            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} />
              <TextInput
                placeholder={t('common.password')}
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                style={styles.input}
                testID="login-password-input"
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <Link href="/(auth)/forgot" asChild>
              <TouchableOpacity style={styles.forgotWrap} testID="login-forgot-link">
                <Text style={styles.forgot}>{t('auth.forgotPassword')}</Text>
              </TouchableOpacity>
            </Link>

            {error ? <Text style={styles.errorText} testID="login-error">{error}</Text> : null}

            <TouchableOpacity style={styles.primaryBtn} onPress={submit} disabled={loading} testID="login-submit-button">
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.primaryBtnText}>{t('common.login')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn} onPress={googleLogin} testID="login-google-button">
                <Image source={{ uri: 'https://cdn.jsdelivr.net/gh/homakov/googlelogo/google-icon.png' }} style={styles.googleIcon} />
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <Link href="/(auth)/otp" asChild>
                <TouchableOpacity style={styles.socialBtn} testID="login-otp-button">
                  <Ionicons name="phone-portrait-outline" size={20} color={Colors.textPrimary} />
                  <Text style={styles.socialText}>OTP</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('auth.dontHaveAccount')} </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity testID="login-register-link">
                  <Text style={styles.footerLink}>{t('common.register')}</Text>
                </TouchableOpacity>
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
  scroll: { flexGrow: 1 },
  heroWrap: { paddingHorizontal: 24, paddingVertical: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  logoBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  title: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.6 },
  sub: { fontSize: 15, color: Colors.textSecondary, marginTop: 6 },
  form: { padding: 24 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 12,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: Colors.textPrimary },
  forgotWrap: { alignSelf: 'flex-end', paddingVertical: 6 },
  forgot: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  errorText: { color: Colors.error, fontSize: 13, marginVertical: 6 },
  primaryBtn: {
    marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textTertiary, fontSize: 13 },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.pill,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  googleIcon: { width: 20, height: 20 },
  socialText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
