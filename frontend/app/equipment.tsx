import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

const CATS = ['all', 'tractor', 'harvester', 'rotavator', 'tiller', 'cultivator'] as const;

export default function Equipment() {
  const router = useRouter();
  const [category, setCategory] = useState<string>('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [booked, setBooked] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.equipment(category === 'all' ? undefined : category);
      setItems(r.equipment);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [category]);

  const book = async () => {
    if (!selected) return;
    const today = new Date();
    const tomorrow = new Date(Date.now() + 86400000);
    try {
      await api.bookEquipment({
        equipment_id: selected.equipment_id,
        start_date: today.toISOString().split('T')[0],
        end_date: tomorrow.toISOString().split('T')[0],
      });
      setBooked(true);
      setTimeout(() => { setBooked(false); setSelected(null); }, 1500);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Equipment Rental</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {CATS.map((c) => (
          <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]} testID={`eq-chip-${c}`}>
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          {items.map((e) => (
            <TouchableOpacity key={e.equipment_id} style={styles.card} onPress={() => setSelected(e)} testID={`eq-${e.equipment_id}`}>
              <Image source={{ uri: e.image }} style={styles.img} />
              <View style={styles.body}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={styles.name} numberOfLines={1}>{e.name}</Text>
                  <View style={styles.ratingBox}>
                    <Ionicons name="star" size={12} color={Colors.secondary} />
                    <Text style={styles.ratingText}>{e.rating}</Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                  <Text style={styles.metaText}>{e.location}</Text>
                  <Text style={{ marginLeft: 'auto', fontSize: 11, color: Colors.textSecondary }}>by {e.owner}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>₹{e.daily_price}<Text style={styles.perDay}>/day</Text></Text>
                  <View style={styles.bookBtn}>
                    <Text style={styles.bookText}>Book Now</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </View>
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
                  <Text style={styles.modalTitle}>Booking Confirmed!</Text>
                  <Text style={{ color: Colors.textSecondary, marginTop: 8 }}>{selected.name}</Text>
                </View>
              ) : (
                <>
                  <Image source={{ uri: selected.image }} style={styles.modalImg} />
                  <Text style={styles.modalTitle}>{selected.name}</Text>
                  <Text style={styles.modalDesc}>{selected.description}</Text>
                  <View style={styles.dateBox}>
                    <View style={styles.dateItem}>
                      <Text style={styles.dateLabel}>Start Date</Text>
                      <Text style={styles.dateValue}>Today</Text>
                    </View>
                    <View style={styles.dateSeparator} />
                    <View style={styles.dateItem}>
                      <Text style={styles.dateLabel}>End Date</Text>
                      <Text style={styles.dateValue}>Tomorrow</Text>
                    </View>
                  </View>
                  <View style={styles.modalPriceRow}>
                    <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>Daily rental</Text>
                    <Text style={styles.modalPrice}>₹{selected.daily_price}</Text>
                  </View>
                  <TouchableOpacity style={styles.confirmBtn} onPress={book} testID="eq-confirm-booking">
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Confirm Booking</Text>
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
  chipsRow: { paddingHorizontal: 16, gap: 8, height: 56, alignItems: 'center', backgroundColor: '#fff' },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
  img: { width: '100%', height: 160, backgroundColor: Colors.surfaceSubtle },
  body: { padding: 14 },
  name: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceSubtle, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  ratingText: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  price: { fontSize: 20, fontWeight: '800', color: Colors.secondary },
  perDay: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500' },
  bookBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill },
  bookText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalImg: { width: '100%', height: 160, borderRadius: 12, backgroundColor: Colors.surfaceSubtle, marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, lineHeight: 20 },
  dateBox: { flexDirection: 'row', backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.lg, padding: 12, marginTop: 16, alignItems: 'center' },
  dateItem: { flex: 1, alignItems: 'center' },
  dateSeparator: { width: 1, height: 30, backgroundColor: Colors.border },
  dateLabel: { fontSize: 11, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  dateValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 3 },
  modalPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  modalPrice: { fontSize: 22, fontWeight: '800', color: Colors.secondary },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 15, alignItems: 'center', marginTop: 16, ...Shadow.floating },
});
