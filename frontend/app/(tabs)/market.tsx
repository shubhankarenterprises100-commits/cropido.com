import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { api, Product } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

const CATEGORY_KEYS = ['all', 'seeds', 'fertilizers', 'pesticides', 'organic', 'equipment', 'irrigation', 'feed'] as const;

export default function Market() {
  const { t } = useTranslation();
  const router = useRouter();
  const [category, setCategory] = useState<string>('all');
  const [q, setQ] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.products(category === 'all' ? undefined : category, q || undefined);
      setProducts(r.products);
    } catch (e) { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [category]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Sticky Header */}
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('market.title')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/cart')} testID="market-cart-button">
              <Ionicons name="cart-outline" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/orders')} testID="market-orders-button">
              <Ionicons name="receipt-outline" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            placeholder={t('market.searchPlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
            returnKeyType="search"
            style={styles.searchInput}
            testID="market-search-input"
          />
          {q ? <TouchableOpacity onPress={() => { setQ(''); load(); }}><Ionicons name="close-circle" size={18} color={Colors.textTertiary} /></TouchableOpacity> : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORY_KEYS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, category === c && styles.chipActive]}
              testID={`market-chip-${c}`}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                {t(`market.categories.${c}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.product_id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 12, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.product_id } })}
            testID={`market-product-${item.product_id}`}
          >
            <Image source={{ uri: item.image }} style={styles.image} />
            <TouchableOpacity style={styles.heart}>
              <Ionicons name="heart-outline" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ padding: 12 }}>
              <Text numberOfLines={2} style={styles.name}>{item.title}</Text>
              <Text numberOfLines={1} style={styles.unit}>{item.unit}</Text>
              <View style={styles.bottomRow}>
                <Text style={styles.price}>₹{item.price}</Text>
                <View style={styles.rating}>
                  <Ionicons name="star" size={11} color={Colors.secondary} />
                  <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name="search" size={40} color={Colors.textTertiary} />
            <Text style={{ color: Colors.textSecondary, marginTop: 8 }}>No products found</Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  headerWrap: { backgroundColor: '#fff', paddingBottom: 12, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, ...Shadow.card },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20,
    backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 4,
  },
  searchInput: { flex: 1, paddingVertical: 12, color: Colors.textPrimary, fontSize: 14 },
  chipsRow: { paddingHorizontal: 20, gap: 8, height: 56, alignItems: 'center' },
  chip: {
    height: 36, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
  image: { width: '100%', height: 140, backgroundColor: Colors.surfaceSubtle },
  heart: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, minHeight: 34 },
  unit: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  price: { fontSize: 16, fontWeight: '800', color: Colors.secondary },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 60 },
});
