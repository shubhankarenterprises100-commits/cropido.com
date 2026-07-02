import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useApp, supportedLanguages } from '@/src/contexts/AppContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, setLanguage, themeMode, setThemeMode } = useApp();
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.chooseLanguage')}</Text>
          {supportedLanguages.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langRow, language === l.code && styles.langRowActive]}
              onPress={() => setLanguage(l.code)}
              testID={`setting-lang-${l.code}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.langNative}>{l.native}</Text>
                <Text style={styles.langLabel}>{l.label}</Text>
              </View>
              {language === l.code && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.row}>
            <View style={styles.iconWrap}><Ionicons name="moon" size={18} color={Colors.textPrimary} /></View>
            <Text style={styles.rowLabel}>{t('profile.darkMode')}</Text>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor="#fff"
              testID="setting-dark-mode-toggle"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Email</Text>
            <Text style={styles.accountValue}>{user?.email}</Text>
          </View>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Phone</Text>
            <Text style={styles.accountValue}>{user?.phone || '—'}</Text>
          </View>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Role</Text>
            <Text style={styles.accountValue}>{user?.role}</Text>
          </View>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Subscription</Text>
            <View style={styles.subBadge}><Text style={styles.subText}>{user?.subscription?.toUpperCase()}</Text></View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} testID="setting-logout">
          <Ionicons name="log-out" size={18} color={Colors.error} />
          <Text style={{ color: Colors.error, fontWeight: '700' }}>{t('common.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  section: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 12, ...Shadow.card },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 6, marginBottom: 8 },
  langRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: Radius.md, gap: 12, marginBottom: 6 },
  langRowActive: { backgroundColor: Colors.primary50 },
  langNative: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  langLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  accountLabel: { color: Colors.textSecondary, fontSize: 13 },
  accountValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  subBadge: { backgroundColor: Colors.primary50, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  subText: { color: Colors.primary, fontSize: 11, fontWeight: '800' },
  logoutBtn: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEE2E2', paddingVertical: 14, borderRadius: Radius.pill, marginTop: 8 },
});
