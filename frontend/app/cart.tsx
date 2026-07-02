import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function Cart() {
  const router = useRouter();
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState('Village Rd, Nashik, MH 422001');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.getCart();
      setCart(r.cart);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = async (pid: string) => {
    await api.removeFromCart(pid);
    load();
  };

  const total = cart.reduce((s, it) => s + (it.product?.price || 0) * it.quantity, 0);

  const checkout = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      const items = cart.map((c) => ({ product_id: c.product_id, title: c.product?.title, price: c.product?.price, quantity: c.quantity }));
      const r = await api.placeOrder(items, address, 'upi');
      setPlaced(r.order.order_id);
      setCart([]);
      setTimeout(() => { setPlaced(null); router.replace('/orders'); }, 1400);
    } catch (e) { /* noop */ }
    setPlacing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>My Cart</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
          {cart.length === 0 && !placed ? (
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={60} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <TouchableOpacity style={styles.shopBtn} onPress={() => router.replace('/(tabs)/market')}>
                <Text style={styles.shopText}>Continue Shopping</Text>
              </TouchableOpacity>
            </View>
          ) : placed ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
              <Text style={styles.emptyTitle}>Order Placed!</Text>
              <Text style={{ color: Colors.textSecondary, marginTop: 4 }}>Order ID: {placed.slice(-8)}</Text>
            </View>
          ) : (
            <>
              {cart.map((it) => (
                <View key={it.product_id} style={styles.cartRow} testID={`cart-row-${it.product_id}`}>
                  <Image source={{ uri: it.product?.image }} style={styles.cartImg} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.cartTitle} numberOfLines={2}>{it.product?.title}</Text>
                    <Text style={styles.cartUnit}>{it.product?.unit}</Text>
                    <View style={styles.cartBottomRow}>
                      <Text style={styles.cartPrice}>₹{it.product?.price} × {it.quantity}</Text>
                      <TouchableOpacity onPress={() => remove(it.product_id)}>
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delivery Address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  style={styles.addressInput}
                  testID="cart-address-input"
                />
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}><Text style={styles.sLabel}>Subtotal</Text><Text style={styles.sValue}>₹{total.toFixed(2)}</Text></View>
                <View style={styles.summaryRow}><Text style={styles.sLabel}>Delivery</Text><Text style={styles.sValue}>FREE</Text></View>
                <View style={styles.summaryRow}><Text style={styles.sLabel}>GST (5%)</Text><Text style={styles.sValue}>₹{(total * 0.05).toFixed(2)}</Text></View>
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 6 }]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>₹{(total * 1.05).toFixed(2)}</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {cart.length > 0 && !placed && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.checkoutBtn} onPress={checkout} disabled={placing} testID="cart-checkout-button">
            {placing ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.checkoutText}>Place Order · ₹{(total * 1.05).toFixed(0)}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  empty: { alignItems: 'center', padding: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  shopBtn: { marginTop: 20, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.pill },
  shopText: { color: '#fff', fontWeight: '700' },
  cartRow: { flexDirection: 'row', backgroundColor: '#fff', margin: 16, marginBottom: 0, marginTop: 12, padding: 12, borderRadius: Radius.lg, ...Shadow.card },
  cartImg: { width: 80, height: 80, borderRadius: 12, backgroundColor: Colors.surfaceSubtle },
  cartTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  cartUnit: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  cartBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cartPrice: { fontSize: 15, fontWeight: '700', color: Colors.secondary },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  addressInput: { backgroundColor: '#fff', padding: 14, borderRadius: Radius.lg, minHeight: 60, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  summaryCard: { backgroundColor: '#fff', margin: 20, padding: 16, borderRadius: Radius.lg, ...Shadow.card, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sLabel: { color: Colors.textSecondary },
  sValue: { color: Colors.textPrimary, fontWeight: '600' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  totalValue: { fontSize: 20, fontWeight: '800', color: Colors.secondary },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border },
  checkoutBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 16, ...Shadow.floating },
  checkoutText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
