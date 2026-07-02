import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

const CATS = ['all', 'rice', 'wheat', 'vegetables', 'fruits', 'pulses'] as const;

export default function CropTrading() {
  const router = useRouter();
  const [category, setCategory] = useState<string>('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ crop: '', category: 'vegetables', quantity: '', expected_price: '', location: '', description: '' });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.crops(category === 'all' ? undefined : category);
      setItems(r.listings);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [category]);

  const submit = async () => {
    try {
      await api.createCrop({
        ...form,
        quantity: Number(form.quantity),
        expected_price: Number(form.expected_price),
        unit: 'quintal',
        negotiable: true,
      });
      setModalOpen(false);
      setForm({ crop: '', category: 'vegetables', quantity: '', expected_price: '', location: '', description: '' });
      load();
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Crop Trading</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)} testID="crop-add-button">
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {CATS.map((c) => (
          <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]} testID={`crop-chip-${c}`}>
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}>
          {items.map((it) => (
            <View key={it.listing_id} style={styles.card}>
              {it.image && <Image source={{ uri: it.image }} style={styles.cardImg} />}
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cropName}>{it.crop}</Text>
                  {it.negotiable && <View style={styles.negotiableBadge}><Text style={styles.negText}>Negotiable</Text></View>}
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                  <Text style={styles.metaText}>{it.location}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="cube-outline" size={12} color={Colors.textTertiary} />
                  <Text style={styles.metaText}>{it.quantity} {it.unit}</Text>
                </View>
                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>Expected</Text>
                    <Text style={styles.priceValue}>₹{it.expected_price}/{it.unit}</Text>
                  </View>
                  <View style={styles.sellerBox}>
                    <Text style={styles.sellerName} numberOfLines={1}>{it.seller_name}</Text>
                    {it.seller_verified && <View style={styles.verifBadge}><Ionicons name="shield-checkmark" size={9} color={Colors.info} /><Text style={styles.verifText}>Verified</Text></View>}
                  </View>
                </View>
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.contactBtn}>
                    <Ionicons name="chatbubble-ellipses" size={14} color={Colors.primary} />
                    <Text style={styles.contactText}>Message</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.callBtn}>
                    <Ionicons name="call" size={14} color="#fff" />
                    <Text style={styles.callText}>Call Seller</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setModalOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>List Your Produce</Text>
            <TextInput placeholder="Crop (e.g., Basmati Rice)" placeholderTextColor={Colors.textTertiary} value={form.crop} onChangeText={(v) => setForm({ ...form, crop: v })} style={styles.formInput} testID="crop-form-name" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput placeholder="Quantity (quintal)" placeholderTextColor={Colors.textTertiary} value={form.quantity} onChangeText={(v) => setForm({ ...form, quantity: v })} keyboardType="numeric" style={[styles.formInput, { flex: 1 }]} testID="crop-form-qty" />
              <TextInput placeholder="Price ₹" placeholderTextColor={Colors.textTertiary} value={form.expected_price} onChangeText={(v) => setForm({ ...form, expected_price: v })} keyboardType="numeric" style={[styles.formInput, { flex: 1 }]} testID="crop-form-price" />
            </View>
            <TextInput placeholder="Location" placeholderTextColor={Colors.textTertiary} value={form.location} onChangeText={(v) => setForm({ ...form, location: v })} style={styles.formInput} testID="crop-form-location" />
            <TextInput placeholder="Description" placeholderTextColor={Colors.textTertiary} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} multiline style={[styles.formInput, { minHeight: 60 }]} testID="crop-form-desc" />
            <TouchableOpacity style={styles.submitBtn} onPress={submit} testID="crop-form-submit">
              <Text style={{ color: '#fff', fontWeight: '700' }}>List Produce</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  chipsRow: { paddingHorizontal: 16, gap: 8, height: 56, alignItems: 'center', backgroundColor: '#fff' },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  chipTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
  cardImg: { width: '100%', height: 140, backgroundColor: Colors.surfaceSubtle },
  cardBody: { padding: 14 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cropName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  negotiableBadge: { backgroundColor: Colors.secondary50, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  negText: { fontSize: 10, color: Colors.secondary, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontSize: 12, color: Colors.textSecondary },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  priceLabel: { fontSize: 11, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  priceValue: { fontSize: 18, fontWeight: '800', color: Colors.secondary },
  sellerBox: { alignItems: 'flex-end' },
  sellerName: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600' },
  verifBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3, backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  verifText: { fontSize: 9, color: Colors.info, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  contactBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.primary },
  contactText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  callBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: Colors.primary },
  callText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 10 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  formInput: { backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
});
