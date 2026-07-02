import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.orders();
      setOrders(r.orders);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {orders.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={50} color={Colors.textTertiary} />
              <Text style={{ color: Colors.textSecondary, marginTop: 8 }}>No orders yet</Text>
            </View>
          ) : orders.map((o) => (
            <View key={o.order_id} style={styles.card} testID={`order-${o.order_id}`}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderId}>#{o.order_id.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.orderDate}>{o.created_at?.substring(0, 10)}</Text>
                </View>
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{o.status}</Text>
                </View>
              </View>
              {o.items.map((it: any, i: number) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.title}</Text>
                  <Text style={styles.itemQty}>× {it.quantity}</Text>
                </View>
              ))}
              <View style={styles.cardFooter}>
                <Text style={styles.tracking}>{o.tracking_status}</Text>
                <Text style={styles.total}>₹{o.total?.toFixed(2)}</Text>
              </View>
            </View>
          ))}
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
  empty: { alignItems: 'center', padding: 60 },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: Radius.lg, marginBottom: 12, ...Shadow.card },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderId: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  orderDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  statusText: { fontSize: 11, color: Colors.primary, fontWeight: '700', textTransform: 'capitalize' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemName: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  itemQty: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, paddingTop: 10 },
  tracking: { fontSize: 12, color: Colors.info, fontWeight: '600' },
  total: { fontSize: 16, fontWeight: '800', color: Colors.secondary },
});
