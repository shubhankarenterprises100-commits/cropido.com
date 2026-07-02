import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function Payments() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { const r = await api.payments(); setItems(r.payments); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Payment History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="card-outline" size={60} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No payments yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {items.map((p) => (
            <View key={p.payment_id} style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name="card" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pTitle}>{p.plan_id?.toUpperCase()} Plan</Text>
                <Text style={styles.pDate}>{p.created_at?.substring(0, 10)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pAmount}>₹{p.amount}</Text>
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{p.status}</Text>
                </View>
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
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#fff', borderRadius: Radius.lg, ...Shadow.card },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary50, alignItems: 'center', justifyContent: 'center' },
  pTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  pDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 3 },
  pAmount: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  statusText: { fontSize: 10, color: Colors.primary, fontWeight: '700', textTransform: 'capitalize' },
});
