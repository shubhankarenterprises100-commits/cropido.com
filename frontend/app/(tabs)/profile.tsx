import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import { useApp } from '@/src/contexts/AppContext';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode } = useApp();

  const items = [
    { key: 'orders', icon: 'receipt' as const, label: t('profile.myOrders'), route: '/orders' as const },
    { key: 'sub', icon: 'ribbon' as const, label: t('profile.subscription'), route: '/subscription' as const, badge: user?.subscription?.toUpperCase() },
    { key: 'payments', icon: 'card' as const, label: t('profile.payments'), route: '/payments' as const },
    ...(user?.role === 'admin' ? [{ key: 'admin', icon: 'shield' as const, label: 'Admin Console', route: '/admin' as const, badge: 'ADMIN' }] : []),
    { key: 'lang', icon: 'language' as const, label: t('profile.language'), route: '/settings' as const },
    { key: 'settings', icon: 'settings' as const, label: t('profile.settings'), route: '/settings' as const },
    { key: 'help', icon: 'help-circle' as const, label: t('profile.help'), route: '/settings' as const },
    { key: 'about', icon: 'information-circle' as const, label: t('profile.about'), route: '/settings' as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[Colors.primary, Colors.primary700]} style={styles.headerGrad}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: user?.picture || 'https://i.pravatar.cc/300?u=' + user?.user_id }} style={styles.avatar} />
            {user?.verified && (
              <View style={styles.verified}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{user?.role?.toUpperCase()} · {user?.email}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>12</Text><Text style={styles.statLabel}>Listings</Text></View>
            <View style={styles.divider} />
            <View style={styles.stat}><Text style={styles.statValue}>48</Text><Text style={styles.statLabel}>Orders</Text></View>
            <View style={styles.divider} />
            <View style={styles.stat}><Text style={styles.statValue}>245</Text><Text style={styles.statLabel}>Community</Text></View>
          </View>
        </LinearGradient>

        <TouchableOpacity style={styles.upgradeCard} onPress={() => router.push('/subscription')} testID="profile-upgrade-card">
          <View style={styles.upgradeIcon}><Ionicons name="rocket" size={20} color={Colors.secondary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.upgradeTitle}>Upgrade to Pro Farmer</Text>
            <Text style={styles.upgradeSub}>Unlimited AI, advanced insights & priority support</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.rowItem}>
            <View style={styles.rowIcon}><Ionicons name="moon" size={18} color={Colors.textPrimary} /></View>
            <Text style={styles.rowLabel}>{t('profile.darkMode')}</Text>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor="#fff"
              testID="profile-dark-mode-toggle"
            />
          </View>

          {items.map((it) => (
            <TouchableOpacity
              key={it.key}
              style={styles.rowItem}
              onPress={() => router.push(it.route)}
              testID={`profile-item-${it.key}`}
            >
              <View style={styles.rowIcon}><Ionicons name={it.icon} size={18} color={Colors.textPrimary} /></View>
              <Text style={styles.rowLabel}>{it.label}</Text>
              {it.badge && <View style={styles.badgePill}><Text style={styles.badgeText}>{it.badge}</Text></View>}
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.rowItem, { borderTopWidth: 6, borderTopColor: Colors.surfaceSubtle }]}
            onPress={logout}
            testID="profile-logout-button"
          >
            <View style={[styles.rowIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="log-out" size={18} color={Colors.error} />
            </View>
            <Text style={[styles.rowLabel, { color: Colors.error, fontWeight: '700' }]}>{t('common.logout')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Cropido v1.0 · Made with ❤️ for Indian farmers</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  headerGrad: { padding: 24, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#fff' },
  verified: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.info, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  role: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, letterSpacing: 0.4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  divider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.25)' },
  upgradeCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: '#fff', borderRadius: Radius.lg,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadow.card,
    borderWidth: 1, borderColor: Colors.secondary100,
  },
  upgradeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondary50, alignItems: 'center', justifyContent: 'center' },
  upgradeTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  upgradeSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  section: { marginTop: 20, backgroundColor: '#fff', marginHorizontal: 20, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: Colors.primary50 },
  badgeText: { color: Colors.primary, fontSize: 10, fontWeight: '700' },
  version: { textAlign: 'center', color: Colors.textTertiary, fontSize: 12, marginTop: 30 },
});
