import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function ProductDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.product(id).then((r) => setProduct(r.product)).catch(() => {});
  }, [id]);

  const addToCart = async () => {
    if (!product) return;
    try {
      await api.addToCart(product.product_id, qty);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    } catch (e) { /* noop */ }
  };

  const buyNow = async () => {
    if (!product) return;
    try {
      await api.addToCart(product.product_id, qty);
      router.push('/cart');
    } catch {}
  };

  if (!product) return (
    <View style={styles.centerFull}><ActivityIndicator color={Colors.primary} /></View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.imgWrap}>
          <Image source={{ uri: product.image }} style={styles.image} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="product-back">
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.wishBtn}>
            <Ionicons name="heart-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          <View style={styles.categoryTag}><Text style={styles.categoryTagText}>{product.category?.toUpperCase()}</Text></View>
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.rowMeta}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={Colors.secondary} />
              <Text style={styles.ratingText}>{product.rating}</Text>
              <Text style={styles.reviewsText}>({product.reviews_count} reviews)</Text>
            </View>
            <View style={styles.stockPill}>
              <View style={styles.stockDot} />
              <Text style={styles.stockText}>In Stock: {product.stock}</Text>
            </View>
          </View>
          <Text style={styles.price}>₹{product.price} <Text style={styles.priceUnit}>/ {product.unit}</Text></Text>

          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.qtyControl}>
              <TouchableOpacity onPress={() => setQty(Math.max(1, qty - 1))} style={styles.qtyBtn} testID="product-qty-minus"><Ionicons name="remove" size={16} color={Colors.textPrimary} /></TouchableOpacity>
              <Text style={styles.qtyValue}>{qty}</Text>
              <TouchableOpacity onPress={() => setQty(qty + 1)} style={styles.qtyBtn} testID="product-qty-plus"><Ionicons name="add" size={16} color={Colors.textPrimary} /></TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>

          <Text style={styles.sectionHeader}>Seller</Text>
          <View style={styles.sellerCard}>
            <View style={styles.sellerIcon}><Ionicons name="storefront" size={18} color={Colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>{product.seller_name}</Text>
              <Text style={styles.sellerMeta}>Verified Seller · 4.8 ★</Text>
            </View>
            <TouchableOpacity><Ionicons name="chatbubble-outline" size={20} color={Colors.primary} /></TouchableOpacity>
          </View>

          {added && (
            <View style={styles.toastAdded} testID="cart-added-toast">
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={{ color: Colors.textPrimary, fontWeight: '600' }}>Added to cart!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cartBtn} onPress={addToCart} testID="product-add-cart">
          <Ionicons name="cart-outline" size={18} color={Colors.primary} />
          <Text style={styles.cartText}>{t('common.addToCart')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buyBtn} onPress={buyNow} testID="product-buy-now">
          <Text style={styles.buyText}>{t('common.buy')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centerFull: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  imgWrap: { position: 'relative' },
  image: { width: '100%', height: 340, backgroundColor: Colors.surfaceSubtle },
  backBtn: { position: 'absolute', top: 12, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  wishBtn: { position: 'absolute', top: 12, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20 },
  categoryTag: { alignSelf: 'flex-start', backgroundColor: Colors.primary50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  categoryTagText: { fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 0.4 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 8, letterSpacing: -0.4 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '700' },
  reviewsText: { fontSize: 12, color: Colors.textTertiary },
  stockPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary50, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  stockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  stockText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  price: { fontSize: 32, fontWeight: '800', color: Colors.secondary, marginTop: 12, letterSpacing: -1 },
  priceUnit: { fontSize: 14, color: Colors.textTertiary, fontWeight: '500' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  qtyLabel: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 4 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, minWidth: 20, textAlign: 'center' },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 24, marginBottom: 8 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surfaceSubtle, padding: 14, borderRadius: Radius.lg },
  sellerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary50, alignItems: 'center', justifyContent: 'center' },
  sellerName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  sellerMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  toastAdded: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DCFCE7', padding: 12, borderRadius: Radius.md, marginTop: 16 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 16,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cartBtn: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.pill,
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  cartText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  buyBtn: { flex: 1.2, backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', ...Shadow.floating },
  buyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
