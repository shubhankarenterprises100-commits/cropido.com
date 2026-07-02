import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import { api } from '@/src/api/client';
import { Colors, Radius, Spacing, Shadow } from '@/src/theme';

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard();
      setData(d);
    } catch (e) { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const quickActions = [
    { key: 'buy', icon: 'basket' as const, label: t('home.actions.buy'), color: Colors.primary, route: '/(tabs)/market' },
    { key: 'sell', icon: 'cash' as const, label: t('home.actions.sell'), color: Colors.secondary, route: '/crop-trading' },
    { key: 'rent', icon: 'construct' as const, label: t('home.actions.rent'), color: '#3B82F6', route: '/equipment' },
    { key: 'ai', icon: 'sparkles' as const, label: t('home.actions.askAI'), color: '#8B5CF6', route: '/(tabs)/assistant' },
    { key: 'services', icon: 'briefcase' as const, label: t('home.actions.services'), color: '#EC4899', route: '/services' },
    { key: 'community', icon: 'people' as const, label: t('home.actions.community'), color: '#F59E0B', route: '/(tabs)/community' },
    { key: 'directory', icon: 'business' as const, label: t('home.actions.directory'), color: '#14B8A6', route: '/directory' },
    { key: 'knowledge', icon: 'book' as const, label: t('home.actions.knowledge'), color: '#EF4444', route: '/knowledge' },
  ];

  if (!data) {
    return (
      <SafeAreaView style={styles.centerBg} edges={['top']}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{t('home.greeting')}, {user?.name?.split(' ')[0] || 'Farmer'}! 👋</Text>
            <View style={styles.locRow}>
              <Ionicons name="location" size={12} color={Colors.textTertiary} />
              <Text style={styles.locText}>Nashik, Maharashtra</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')} testID="home-notifications-button">
            <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
            <View style={styles.badge} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/messages')} testID="home-messages-button">
            <Ionicons name="chatbubbles-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Weather card */}
        <LinearGradient
          colors={[Colors.primary, Colors.primary700]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.weatherCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.weatherLoc}>{data.weather.location}</Text>
            <Text style={styles.weatherTemp}>{data.weather.temp}°</Text>
            <Text style={styles.weatherCond}>{data.weather.condition}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <View style={styles.wStat}><Ionicons name="water" size={12} color="#fff" /><Text style={styles.wStatText}>{data.weather.humidity}%</Text></View>
              <View style={styles.wStat}><Ionicons name="cloud" size={12} color="#fff" /><Text style={styles.wStatText}>{data.weather.wind} km/h</Text></View>
            </View>
          </View>
          <View style={styles.forecast}>
            {data.weather.forecast.map((f: any) => (
              <View key={f.day} style={styles.forecastItem}>
                <Text style={styles.fDay}>{f.day}</Text>
                <Ionicons name={f.icon as any} size={20} color="#FFCC80" />
                <Text style={styles.fTemp}>{f.temp}°</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Quick Actions Bento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
          <View style={styles.bento}>
            {quickActions.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={styles.bentoItem}
                onPress={() => router.push(a.route as any)}
                testID={`home-action-${a.key}`}
              >
                <View style={[styles.bentoIcon, { backgroundColor: `${a.color}15` }]}>
                  <Ionicons name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={styles.bentoLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Market prices ticker */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.marketPrices')}</Text>
            <TouchableOpacity><Text style={styles.viewAll}>{t('common.viewAll')}</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
            {data.market_prices.map((p: any) => (
              <View key={p.crop} style={styles.priceCard}>
                <Text style={styles.priceCrop}>{p.crop}</Text>
                <Text style={styles.priceValue}>₹{p.price}</Text>
                <Text style={styles.priceUnit}>per {p.unit}</Text>
                <View style={[styles.trendPill, { backgroundColor: p.change >= 0 ? '#E8F5E9' : '#FEE2E2' }]}>
                  <Ionicons name={p.change >= 0 ? 'trending-up' : 'trending-down'} size={11} color={p.change >= 0 ? Colors.primary : Colors.error} />
                  <Text style={[styles.trendText, { color: p.change >= 0 ? Colors.primary : Colors.error }]}>
                    {p.change > 0 ? '+' : ''}{p.change}%
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* AI Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.insights')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/assistant')} activeOpacity={0.9}>
            <LinearGradient colors={['#8B5CF6', '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.insightCard}>
              <View style={styles.insightIcon}><Ionicons name="sparkles" size={18} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>AI Recommendation</Text>
                <Text style={styles.insightText}>{data.recommendations[0]}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Featured products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.featured')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/market')}><Text style={styles.viewAll}>{t('common.viewAll')}</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
            {data.featured_products.slice(0, 6).map((p: any) => (
              <TouchableOpacity
                key={p.product_id}
                style={styles.productCard}
                onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.product_id } })}
                testID={`home-product-${p.product_id}`}
              >
                <Image source={{ uri: p.image }} style={styles.productImage} />
                <View style={{ padding: 10 }}>
                  <Text style={styles.productTitle} numberOfLines={2}>{p.title}</Text>
                  <View style={styles.productBottom}>
                    <Text style={styles.productPrice}>₹{p.price}</Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={11} color={Colors.secondary} />
                      <Text style={styles.ratingText}>{p.rating}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Trending crops */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.trending')}</Text>
            <TouchableOpacity onPress={() => router.push('/crop-trading')}><Text style={styles.viewAll}>{t('common.viewAll')}</Text></TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {data.trending_crops.slice(0, 3).map((c: any) => (
              <TouchableOpacity key={c.listing_id} style={styles.cropCard}>
                <Image source={{ uri: c.image }} style={styles.cropImage} />
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text style={styles.cropName} numberOfLines={1}>{c.crop}</Text>
                  <Text style={styles.cropLoc} numberOfLines={1}>
                    <Ionicons name="location-outline" size={11} color={Colors.textTertiary} /> {c.location}
                  </Text>
                  <Text style={styles.cropQty}>{c.quantity} {c.unit}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cropPrice}>₹{c.expected_price}</Text>
                  {c.seller_verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="shield-checkmark" size={10} color={Colors.info} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nearby services */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.services')}</Text>
            <TouchableOpacity onPress={() => router.push('/services')}><Text style={styles.viewAll}>{t('common.viewAll')}</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
            {data.nearby_services.map((s: any) => (
              <TouchableOpacity key={s.service_id} style={styles.serviceCard} onPress={() => router.push('/services')}>
                <View style={styles.serviceIcon}>
                  <Ionicons name={(s.icon || 'briefcase') as any} size={20} color={Colors.primary} />
                </View>
                <Text style={styles.serviceName} numberOfLines={2}>{s.name}</Text>
                <Text style={styles.servicePrice}>₹{s.price}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* News */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.news')}</Text>
            <TouchableOpacity onPress={() => router.push('/knowledge')}><Text style={styles.viewAll}>{t('common.viewAll')}</Text></TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {data.news.slice(0, 3).map((n: any) => (
              <TouchableOpacity key={n.article_id} style={styles.newsCard} onPress={() => router.push('/knowledge')}>
                <Image source={{ uri: n.image }} style={styles.newsImg} />
                <View style={{ flex: 1, paddingLeft: 12 }}>
                  <Text style={styles.newsTitle} numberOfLines={2}>{n.title}</Text>
                  <Text style={styles.newsMeta}>{n.read_time} · {n.author}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  centerBg: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  greeting: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locText: { fontSize: 12, color: Colors.textTertiary },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...Shadow.card },
  badge: { position: 'absolute', top: 8, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
  weatherCard: {
    marginHorizontal: 20, marginTop: 8, padding: 20, borderRadius: Radius.xxl, flexDirection: 'row', alignItems: 'center', gap: 12,
    ...Shadow.floating,
  },
  weatherLoc: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  weatherTemp: { color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: -1, lineHeight: 48 },
  weatherCond: { color: '#fff', fontSize: 14, fontWeight: '500' },
  wStat: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  wStatText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  forecast: { gap: 8 },
  forecastItem: { alignItems: 'center', gap: 3 },
  fDay: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  fTemp: { color: '#fff', fontSize: 13, fontWeight: '700' },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: 20, letterSpacing: -0.3 },
  viewAll: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  bento: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginTop: 12 },
  bentoItem: { width: '22.5%', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 12, alignItems: 'center', ...Shadow.card },
  bentoIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  bentoLabel: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  priceCard: {
    backgroundColor: '#fff', padding: 14, borderRadius: Radius.lg, minWidth: 140, ...Shadow.card, marginTop: 12,
  },
  priceCrop: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  priceValue: { fontSize: 22, color: Colors.textPrimary, fontWeight: '800', marginTop: 4 },
  priceUnit: { fontSize: 11, color: Colors.textTertiary, marginBottom: 8 },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  trendText: { fontSize: 11, fontWeight: '700' },
  insightCard: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  insightTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  insightText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  productCard: { backgroundColor: '#fff', borderRadius: Radius.lg, width: 160, overflow: 'hidden', ...Shadow.card, marginTop: 12 },
  productImage: { width: '100%', height: 110, backgroundColor: Colors.surfaceSubtle },
  productTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, minHeight: 36 },
  productBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  productPrice: { fontSize: 15, fontWeight: '800', color: Colors.secondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  cropCard: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 10, flexDirection: 'row', alignItems: 'center', ...Shadow.card },
  cropImage: { width: 60, height: 60, borderRadius: 12 },
  cropName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  cropLoc: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  cropQty: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cropPrice: { fontSize: 15, fontWeight: '800', color: Colors.secondary },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  verifiedText: { fontSize: 10, color: Colors.info, fontWeight: '700' },
  serviceCard: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 14, width: 150, ...Shadow.card, marginTop: 12 },
  serviceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary50, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  serviceName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, minHeight: 36 },
  servicePrice: { fontSize: 14, fontWeight: '800', color: Colors.secondary, marginTop: 6 },
  newsCard: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 10, flexDirection: 'row', alignItems: 'center', ...Shadow.card },
  newsImg: { width: 70, height: 70, borderRadius: 10, backgroundColor: Colors.surfaceSubtle },
  newsTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  newsMeta: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
});
