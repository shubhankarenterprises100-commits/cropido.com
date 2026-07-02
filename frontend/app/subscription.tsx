import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { Colors, Radius, Shadow } from '@/src/theme';

function getOriginUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_BACKEND_URL || 'https://agri-marketplace-144.preview.emergentagent.com';
}

export default function Subscription() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState('free');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try { const r = await api.plans(); setPlans(r.plans); setCurrent(r.current); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const subscribe = async (planId: string, price: number) => {
    setError('');
    setSubscribing(planId);
    try {
      if (price === 0) {
        // Downgrade to free — call mock endpoint
        await api.subscribe(planId);
        await refresh();
        setCurrent(planId);
      } else {
        const origin = getOriginUrl();
        const r = await api.checkoutSubscription(planId, origin);
        const url = r.url;
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') window.location.href = url;
        } else {
          const result = await WebBrowser.openAuthSessionAsync(url, `${origin}/payment-success`);
          if (result.type === 'success' && result.url) {
            const params = new URLSearchParams(result.url.split('?')[1] || '');
            const sid = params.get('session_id');
            if (sid) router.push({ pathname: '/payment-success', params: { session_id: sid } });
          }
        }
      }
    } catch (e: any) {
      setError(e.message || 'Checkout failed');
    }
    setSubscribing(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Subscription Plans</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
          <View style={styles.heroCard}>
            <Ionicons name="rocket" size={30} color={Colors.secondary} />
            <Text style={styles.heroTitle}>Grow your farming business</Text>
            <Text style={styles.heroSub}>Real Stripe test-mode checkout. Use card 4242 4242 4242 4242.</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {plans.map((p) => {
            const isCurrent = current === p.plan_id;
            const isHighlight = p.highlight;
            return (
              <View key={p.plan_id} style={[styles.planCard, isHighlight && styles.planCardHighlight]}>
                {isHighlight && (
                  <LinearGradient colors={[Colors.secondary, Colors.secondary700]} style={styles.popularBadge}>
                    <Text style={styles.popularText}>MOST POPULAR</Text>
                  </LinearGradient>
                )}
                <Text style={[styles.planName, isHighlight && { color: Colors.secondary }]}>{p.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 8 }}>
                  <Text style={styles.planPrice}>{p.price === 0 ? 'Free' : `₹${p.price}`}</Text>
                  {p.price > 0 && <Text style={styles.planPeriod}>/{p.period}</Text>}
                </View>
                <View style={styles.features}>
                  {p.features.map((f: string, i: number) => (
                    <View key={i} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                {isCurrent ? (
                  <View style={styles.currentBtn}>
                    <Ionicons name="checkmark" size={16} color={Colors.primary} />
                    <Text style={{ color: Colors.primary, fontWeight: '700' }}>Current Plan</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.selectBtn, isHighlight && { backgroundColor: Colors.secondary }]}
                    onPress={() => subscribe(p.plan_id, p.price)}
                    disabled={!!subscribing}
                    testID={`sub-select-${p.plan_id}`}
                  >
                    {subscribing === p.plan_id ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Text style={styles.selectText}>{p.price === 0 ? p.cta : `${p.cta} · Pay with Stripe`}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
          <Text style={styles.footerNote}>Cancel anytime. Prices in INR. Powered by Stripe.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  heroCard: { alignItems: 'center', padding: 20, backgroundColor: '#fff', borderRadius: Radius.lg, ...Shadow.card },
  heroTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginTop: 10, letterSpacing: -0.3 },
  heroSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  error: { color: Colors.error, backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, fontSize: 13, textAlign: 'center' },
  planCard: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 20, ...Shadow.card, borderWidth: 1, borderColor: Colors.border, position: 'relative' },
  planCardHighlight: { borderColor: Colors.secondary, borderWidth: 2 },
  popularBadge: { position: 'absolute', top: -12, right: 20, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  popularText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  planName: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  planPrice: { fontSize: 36, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1, lineHeight: 40 },
  planPeriod: { color: Colors.textSecondary, fontSize: 14, marginBottom: 6 },
  features: { marginTop: 16, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  currentBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: Colors.primary50 },
  selectBtn: { backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  selectText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footerNote: { textAlign: 'center', color: Colors.textTertiary, fontSize: 12, marginTop: 6 },
});
