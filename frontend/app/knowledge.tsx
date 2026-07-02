import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

const CATS = ['all', 'guides', 'tutorials', 'schemes', 'success', 'market'] as const;

export default function Knowledge() {
  const router = useRouter();
  const [category, setCategory] = useState<string>('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await api.knowledge(category === 'all' ? undefined : category); setItems(r.articles); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [category]);

  const featured = items[0];
  const rest = items.slice(1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Knowledge Center</Text>
        <TouchableOpacity style={styles.iconBtn}><Ionicons name="bookmark-outline" size={20} color={Colors.textPrimary} /></TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {CATS.map((c) => (
          <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]} testID={`kn-chip-${c}`}>
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          {featured && (
            <TouchableOpacity style={styles.featured}>
              <Image source={{ uri: featured.image }} style={styles.featuredImg} />
              <View style={styles.featuredOverlay}>
                <View style={styles.badge}><Text style={styles.badgeText}>{featured.category?.toUpperCase()}</Text></View>
                <Text style={styles.featuredTitle}>{featured.title}</Text>
                <Text style={styles.featuredMeta}>{featured.author} · {featured.read_time} · {featured.views.toLocaleString()} views</Text>
              </View>
              {featured.is_video && (
                <View style={styles.playIcon}><Ionicons name="play" size={20} color="#fff" /></View>
              )}
            </TouchableOpacity>
          )}
          {rest.map((a) => (
            <TouchableOpacity key={a.article_id} style={styles.row}>
              <Image source={{ uri: a.image }} style={styles.rowImg} />
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <View style={styles.smBadge}><Text style={styles.smBadgeText}>{a.category?.toUpperCase()}</Text></View>
                <Text style={styles.rowTitle} numberOfLines={2}>{a.title}</Text>
                <Text style={styles.rowMeta}>{a.read_time} · {a.author}</Text>
              </View>
            </TouchableOpacity>
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
  chipsRow: { paddingHorizontal: 16, gap: 8, height: 56, alignItems: 'center', backgroundColor: '#fff' },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  featured: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card, position: 'relative' },
  featuredImg: { width: '100%', height: 220, backgroundColor: Colors.surfaceSubtle },
  featuredOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  badge: { alignSelf: 'flex-start', backgroundColor: Colors.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '800', letterSpacing: 0.4 },
  featuredTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 8, letterSpacing: -0.3 },
  featuredMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4 },
  playIcon: { position: 'absolute', top: '35%', alignSelf: 'center', width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: Radius.lg, ...Shadow.card },
  rowImg: { width: 90, height: 90, borderRadius: 10, backgroundColor: Colors.surfaceSubtle },
  smBadge: { alignSelf: 'flex-start', backgroundColor: Colors.primary50, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  smBadgeText: { fontSize: 9, color: Colors.primary, fontWeight: '800', letterSpacing: 0.3 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 6, lineHeight: 20 },
  rowMeta: { fontSize: 11, color: Colors.textTertiary, marginTop: 6 },
});
