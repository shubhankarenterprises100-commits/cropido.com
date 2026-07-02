import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { Colors, Radius, Shadow } from '@/src/theme';

const TABS = ['overview', 'users', 'products'] as const;

export default function Admin() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<typeof TABS[number]>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const s = await api.adminStats();
        setStats(s);
        const u = await api.adminUsers();
        setUsers(u.users);
        const p = await api.products();
        setProducts(p.products);
      }
    } catch (e) { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isAdmin]);

  const verifyUser = async (uid: string) => {
    try {
      await api.adminVerifyUser(uid);
      setUsers((us) => us.map((x) => x.user_id === uid ? { ...x, verified: true, kyc_verified: true } : x));
    } catch {}
  };

  const deleteProduct = async (pid: string) => {
    try {
      await api.adminDeleteProduct(pid);
      setProducts((ps) => ps.filter((x) => x.product_id !== pid));
    } catch {}
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
          <Text style={styles.title}>Admin</Text><View style={{ width: 40 }} />
        </View>
        <View style={styles.gate}>
          <Ionicons name="lock-closed" size={60} color={Colors.textTertiary} />
          <Text style={styles.gateTitle}>Admin Access Required</Text>
          <Text style={styles.gateSub}>Login as admin@cropido.app to view this dashboard.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#1F2937', '#111827']} style={styles.headerGrad}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtnDark}><Ionicons name="arrow-back" size={20} color="#fff" /></TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Admin Console</Text>
          <Text style={styles.headerSub}>{user?.email}</Text>
        </View>
        <View style={styles.adminBadge}><Ionicons name="shield" size={12} color="#fff" /><Text style={styles.adminBadgeText}>ADMIN</Text></View>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((tk) => (
          <TouchableOpacity
            key={tk}
            style={[styles.tab, tab === tk && styles.tabActive]}
            onPress={() => setTab(tk)}
            testID={`admin-tab-${tk}`}
          >
            <Text style={[styles.tabText, tab === tk && styles.tabTextActive]}>{tk.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          {tab === 'overview' && stats && (
            <>
              <View style={styles.statsGrid}>
                <StatCard label="Users" value={stats.totals.users} icon="people" color={Colors.primary} />
                <StatCard label="Verified" value={stats.totals.verified} icon="shield-checkmark" color={Colors.info} />
                <StatCard label="Products" value={stats.totals.products} icon="basket" color={Colors.secondary} />
                <StatCard label="Crop Listings" value={stats.totals.crop_listings} icon="leaf" color="#8B5CF6" />
                <StatCard label="Orders" value={stats.totals.orders} icon="receipt" color="#EC4899" />
                <StatCard label="Bookings" value={stats.totals.service_bookings + stats.totals.equipment_bookings} icon="calendar" color="#F59E0B" />
              </View>

              <View style={styles.revenueCard}>
                <Text style={styles.revLabel}>Total Revenue</Text>
                <Text style={styles.revValue}>₹{stats.totals.revenue.toLocaleString()}</Text>
                <Text style={styles.revSub}>{stats.totals.paid_transactions} paid transactions</Text>
              </View>

              <Text style={styles.sectionTitle}>Subscription Breakdown</Text>
              <View style={styles.planGrid}>
                {Object.entries(stats.plan_counts).map(([k, v]) => (
                  <View key={k} style={styles.planPill}>
                    <Text style={styles.planPillName}>{k.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={styles.planPillValue}>{v as number}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Recent Orders</Text>
              {stats.recent_orders.length === 0 ? (
                <Text style={{ color: Colors.textSecondary, textAlign: 'center', padding: 20 }}>No orders yet</Text>
              ) : stats.recent_orders.map((o: any) => (
                <View key={o.order_id} style={styles.recentOrder}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentOrderId}>#{o.order_id?.slice(-8).toUpperCase()}</Text>
                    <Text style={styles.recentOrderMeta}>{o.items?.length} items · {o.created_at?.substring(0, 10)}</Text>
                  </View>
                  <Text style={styles.recentOrderTotal}>₹{o.total?.toFixed(0)}</Text>
                </View>
              ))}
            </>
          )}

          {tab === 'users' && (
            <>
              <Text style={styles.sectionTitle}>All Users ({users.length})</Text>
              {users.map((u) => (
                <View key={u.user_id} style={styles.userRow}>
                  <Image source={{ uri: u.picture || `https://i.pravatar.cc/150?u=${u.user_id}` }} style={styles.userAvatar} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>{u.name}</Text>
                      {u.verified && <Ionicons name="checkmark-circle" size={14} color={Colors.info} />}
                      {u.role === 'admin' && <View style={styles.roleTag}><Text style={styles.roleTagText}>ADMIN</Text></View>}
                    </View>
                    <Text style={styles.userMeta}>{u.email} · {u.role} · {u.subscription}</Text>
                  </View>
                  {!u.verified && u.role !== 'admin' && (
                    <TouchableOpacity onPress={() => verifyUser(u.user_id)} style={styles.verifyBtn} testID={`admin-verify-${u.user_id}`}>
                      <Ionicons name="shield-checkmark" size={14} color="#fff" />
                      <Text style={styles.verifyText}>Verify</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}

          {tab === 'products' && (
            <>
              <Text style={styles.sectionTitle}>Product Moderation ({products.length})</Text>
              {products.map((p) => (
                <View key={p.product_id} style={styles.productRow}>
                  <Image source={{ uri: p.image }} style={styles.productImg} />
                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    <Text style={styles.productTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.productMeta}>{p.category} · ₹{p.price} · Stock: {p.stock}</Text>
                    <Text style={styles.productSeller}>Seller: {p.seller_name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteProduct(p.product_id)} style={styles.deleteBtn} testID={`admin-delete-${p.product_id}`}>
                    <Ionicons name="trash" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.icon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={statStyles.value}>{value.toLocaleString()}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { width: '31%', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 12, alignItems: 'flex-start', ...Shadow.card },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  value: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  label: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  iconBtnDark: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  headerGrad: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', backgroundColor: Colors.secondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  adminBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  tabsRow: { paddingHorizontal: 16, gap: 8, height: 56, alignItems: 'center', backgroundColor: '#fff' },
  tab: { height: 36, paddingHorizontal: 18, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tabActive: { backgroundColor: '#111827', borderColor: '#111827' },
  tabText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  tabTextActive: { color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  revenueCard: { marginTop: 12, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 16, ...Shadow.floating },
  revLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  revValue: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  revSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginTop: 20, marginBottom: 10 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planPill: { flex: 1, minWidth: '30%', backgroundColor: '#fff', padding: 10, borderRadius: Radius.md, ...Shadow.card },
  planPillName: { fontSize: 10, color: Colors.textTertiary, fontWeight: '800', letterSpacing: 0.4 },
  planPillValue: { fontSize: 20, color: Colors.textPrimary, fontWeight: '800', marginTop: 2 },
  recentOrder: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: Radius.md, marginBottom: 6, ...Shadow.card },
  recentOrderId: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  recentOrderMeta: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  recentOrderTotal: { fontSize: 14, fontWeight: '800', color: Colors.secondary },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#fff', borderRadius: Radius.md, marginBottom: 6, ...Shadow.card },
  userAvatar: { width: 40, height: 40, borderRadius: 20 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  userName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  userMeta: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  roleTag: { backgroundColor: Colors.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleTagText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.info, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill },
  verifyText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  productRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#fff', borderRadius: Radius.md, marginBottom: 6, ...Shadow.card },
  productImg: { width: 50, height: 50, borderRadius: 8 },
  productTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  productMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  productSeller: { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  deleteBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  gateTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginTop: 16 },
  gateSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
});
