import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

const CATS = ['all', 'buyers', 'suppliers', 'traders', 'consultants', 'dealers', 'service_providers'] as const;

export default function Directory() {
  const router = useRouter();
  const [category, setCategory] = useState<string>('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await api.businesses(category === 'all' ? undefined : category, q || undefined); setItems(r.businesses); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [category]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Business Directory</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ backgroundColor: '#fff', paddingBottom: 12 }}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            placeholder="Search businesses…"
            placeholderTextColor={Colors.textTertiary}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
            style={styles.search}
            testID="directory-search"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {CATS.map((c) => (
            <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]} testID={`dir-chip-${c}`}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c.replace('_', ' ').toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          {items.map((b) => (
            <View key={b.business_id} style={styles.card}>
              <Image source={{ uri: b.logo }} style={styles.logo} />
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{b.name}</Text>
                  {b.verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="shield-checkmark" size={10} color={Colors.info} />
                    </View>
                  )}
                </View>
                <Text style={styles.category}>{b.category?.replace('_', ' ').toUpperCase()}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={11} color={Colors.textTertiary} />
                  <Text style={styles.metaText}>{b.location}</Text>
                  <Ionicons name="star" size={11} color={Colors.secondary} style={{ marginLeft: 8 }} />
                  <Text style={styles.metaText}>{b.rating}</Text>
                </View>
                <Text style={styles.desc} numberOfLines={2}>{b.description}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${b.phone}`)} testID={`dir-call-${b.business_id}`}>
                    <Ionicons name="call" size={14} color="#fff" />
                    <Text style={styles.callText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.msgBtn}>
                    <Ionicons name="chatbubble-ellipses" size={14} color={Colors.primary} />
                    <Text style={styles.msgText}>Message</Text>
                  </TouchableOpacity>
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
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 2 },
  search: { flex: 1, paddingVertical: 10, color: Colors.textPrimary, fontSize: 14 },
  chipsRow: { paddingHorizontal: 16, gap: 8, height: 56, alignItems: 'center' },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  card: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: Radius.lg, ...Shadow.card },
  logo: { width: 70, height: 70, borderRadius: 14, backgroundColor: Colors.surfaceSubtle },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  verifiedBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  category: { fontSize: 10, color: Colors.primary, fontWeight: '800', marginTop: 3, letterSpacing: 0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  metaText: { fontSize: 11, color: Colors.textSecondary },
  desc: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  callBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  callText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  msgBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.primary },
  msgText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
});
