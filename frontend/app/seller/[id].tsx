import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function SellerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'listings' | 'products'>('listings');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.seller(id as string);
        setData(r);
      } catch (e: any) {
        Alert.alert('Not found', 'Seller profile could not be loaded.', [{ text: 'Back', onPress: () => router.back() }]);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 80 }} color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }
  if (!data) return null;
  const s = data.seller || {};
  const listings = data.listings || [];
  const products = data.products || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <LinearGradient colors={['#166534', '#065F46']} style={styles.hero}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtnDark}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Image source={{ uri: s.picture || `https://i.pravatar.cc/150?u=${s.user_id}` }} style={styles.avatar} />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, alignItems: 'center' }}>
              <Text style={styles.name}>{s.name}</Text>
              {s.verified && (
                <View style={styles.vChip}>
                  <Ionicons name="checkmark-circle" size={12} color="#fff" />
                  <Text style={styles.vChipText}>Verified</Text>
                </View>
              )}
            </View>
            <Text style={styles.roleText}>{(s.role || 'farmer').toUpperCase()} · Member since {formatDate(s.member_since)}</Text>
            {s.bio ? <Text style={styles.bio}>{s.bio}</Text> : null}
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBlock label="Rating" value={`★ ${s.seller_rating ?? 4.6}`} color="#F59E0B" />
          <StatBlock label="Listings" value={String(s.listings_count ?? 0)} color={Colors.primary} />
          <StatBlock label="Trades" value={String(s.completed_trades ?? 0)} color={Colors.info} />
          <StatBlock label="KYC" value={s.kyc_verified ? 'Verified' : 'Pending'} color={s.kyc_verified ? Colors.success : Colors.warning} />
        </View>

        {/* Farm details */}
        {s.farm_details && (s.farm_details.size_acres || s.farm_details.irrigation) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Farm Details</Text>
            <View style={styles.farmGrid}>
              {s.farm_details.size_acres ? (
                <View style={styles.farmItem}>
                  <Ionicons name="leaf" size={18} color={Colors.primary} />
                  <View>
                    <Text style={styles.farmLabel}>Farm Size</Text>
                    <Text style={styles.farmValue}>{s.farm_details.size_acres} acres</Text>
                  </View>
                </View>
              ) : null}
              {s.farm_details.irrigation ? (
                <View style={styles.farmItem}>
                  <Ionicons name="water" size={18} color={Colors.info} />
                  <View>
                    <Text style={styles.farmLabel}>Irrigation</Text>
                    <Text style={styles.farmValue}>{s.farm_details.irrigation}</Text>
                  </View>
                </View>
              ) : null}
            </View>
            {s.crops_grown && s.crops_grown.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.farmLabel}>Crops grown</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {s.crops_grown.map((c: string) => (
                    <View key={c} style={styles.cropTag}><Text style={styles.cropTagText}>{c}</Text></View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'listings' && styles.tabBtnActive]} onPress={() => setTab('listings')}>
            <Text style={[styles.tabText, tab === 'listings' && styles.tabTextActive]}>Crops ({listings.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'products' && styles.tabBtnActive]} onPress={() => setTab('products')}>
            <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>Products ({products.length})</Text>
          </TouchableOpacity>
        </View>

        {/* Items grid */}
        {tab === 'listings' ? (
          listings.length === 0 ? (
            <Text style={styles.emptyText}>No active listings.</Text>
          ) : (
            <View style={styles.grid}>
              {listings.map((l: any) => (
                <TouchableOpacity key={l.listing_id} style={styles.gridCard} onPress={() => router.push(`/crop/${l.listing_id}` as any)}>
                  {l.image && <Image source={{ uri: l.image }} style={styles.gridImg} />}
                  <View style={{ padding: 10 }}>
                    <Text style={styles.gridTitle} numberOfLines={1}>{l.crop}</Text>
                    {l.crop_variety ? <Text style={styles.gridSub} numberOfLines={1}>{l.crop_variety}</Text> : null}
                    <Text style={styles.gridPrice}>₹{l.expected_price}/{l.unit}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : (
          products.length === 0 ? (
            <Text style={styles.emptyText}>No products.</Text>
          ) : (
            <View style={styles.grid}>
              {products.map((p: any) => (
                <TouchableOpacity key={p.product_id} style={styles.gridCard} onPress={() => router.push(`/product/${p.product_id}` as any)}>
                  {p.image && <Image source={{ uri: p.image }} style={styles.gridImg} />}
                  <View style={{ padding: 10 }}>
                    <Text style={styles.gridTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.gridPrice}>₹{p.price}/{p.unit}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        )}

        {/* Contact CTA */}
        {s.phone ? (
          <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${s.phone}`)}>
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.contactText}>Call Seller</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  hero: { paddingBottom: 24, paddingHorizontal: 20, paddingTop: 10 },
  iconBtnDark: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: '#fff' },
  name: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  vChip: { flexDirection: 'row', gap: 3, alignItems: 'center', backgroundColor: Colors.info, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  vChipText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  roleText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 6, letterSpacing: 0.3, fontWeight: '700' },
  bio: { color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', marginTop: 10, paddingHorizontal: 20, lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 8, padding: 16, marginTop: -20, marginHorizontal: 16, backgroundColor: '#fff', borderRadius: Radius.lg, ...Shadow.card },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 10, color: Colors.textTertiary, marginTop: 3, fontWeight: '700', textTransform: 'uppercase' },

  section: { backgroundColor: '#fff', marginTop: 10, paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  farmGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  farmItem: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.md, minWidth: '45%' },
  farmLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '700', textTransform: 'uppercase' },
  farmValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '800', marginTop: 2 },
  cropTag: { backgroundColor: Colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  cropTagText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: '#fff' },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  tabTextActive: { color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  gridCard: { width: '48%', backgroundColor: '#fff', borderRadius: Radius.md, overflow: 'hidden', ...Shadow.card },
  gridImg: { width: '100%', height: 110 },
  gridTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  gridSub: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  gridPrice: { fontSize: 13, color: Colors.secondary, fontWeight: '800', marginTop: 4 },
  emptyText: { textAlign: 'center', color: Colors.textTertiary, padding: 30, fontSize: 13 },

  contactBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: Radius.pill, marginHorizontal: 20, marginTop: 20, ...Shadow.floating },
  contactText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
