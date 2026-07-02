import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function Services() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [booked, setBooked] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await api.services(); setItems(r.services); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const book = async () => {
    if (!selected) return;
    const date = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    try {
      await api.bookService({ service_id: selected.service_id, date, notes: 'Confirmed via app' });
      setBooked(true);
      setTimeout(() => { setBooked(false); setSelected(null); }, 1400);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Agri Services</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          {items.map((s) => (
            <TouchableOpacity key={s.service_id} style={styles.card} onPress={() => setSelected(s)} testID={`svc-${s.service_id}`}>
              <View style={styles.iconWrap}>
                <Ionicons name={s.icon as any} size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.desc} numberOfLines={2}>{s.description}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.rating}>
                    <Ionicons name="star" size={11} color={Colors.secondary} />
                    <Text style={styles.ratingText}>{s.rating}</Text>
                  </View>
                  <Text style={styles.provider}>{s.provider}</Text>
                </View>
              </View>
              <View style={styles.priceCol}>
                <Text style={styles.price}>₹{s.price}</Text>
                <View style={styles.bookIcon}>
                  <Ionicons name="chevron-forward" size={14} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelected(null)} />
          {selected && (
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              {booked ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
                  <Text style={styles.modalTitle}>Service Booked!</Text>
                  <Text style={{ color: Colors.textSecondary, marginTop: 6 }}>Provider will contact you soon</Text>
                </View>
              ) : (
                <>
                  <View style={styles.modalIconWrap}>
                    <Ionicons name={selected.icon} size={28} color={Colors.primary} />
                  </View>
                  <Text style={styles.modalTitle}>{selected.name}</Text>
                  <Text style={styles.modalDesc}>{selected.description}</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.dLabel}>Provider</Text>
                    <Text style={styles.dValue}>{selected.provider}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.dLabel}>Date</Text>
                    <Text style={styles.dValue}>Tomorrow</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.dLabel}>Price</Text>
                    <Text style={[styles.dValue, { color: Colors.secondary, fontSize: 20, fontWeight: '800' }]}>₹{selected.price}</Text>
                  </View>
                  <TouchableOpacity style={styles.confirmBtn} onPress={book} testID="svc-confirm-booking">
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Book Service</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: Radius.lg, ...Shadow.card },
  iconWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.primary50, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  desc: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary },
  provider: { fontSize: 11, color: Colors.textSecondary },
  priceCol: { alignItems: 'center', gap: 6 },
  price: { fontSize: 16, fontWeight: '800', color: Colors.secondary },
  bookIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary50, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, lineHeight: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dLabel: { color: Colors.textSecondary },
  dValue: { color: Colors.textPrimary, fontWeight: '600' },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 15, alignItems: 'center', marginTop: 20, ...Shadow.floating },
});
