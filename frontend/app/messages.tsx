import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function Messages() {
  const router = useRouter();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await api.threads(); setThreads(r.threads); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : threads.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={60} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySub}>Start chatting with buyers, sellers or experts</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/directory')}>
            <Text style={styles.exploreText}>Explore Directory</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {threads.map((t) => (
            <TouchableOpacity key={t.thread_id} style={styles.thread}>
              <Image source={{ uri: t.other_picture || 'https://i.pravatar.cc/150' }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.otherName}>{t.other_name}</Text>
                  <Text style={styles.time}>{t.updated_at?.substring(11, 16)}</Text>
                </View>
                <Text style={styles.lastMsg} numberOfLines={1}>{t.last_message}</Text>
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
  empty: { alignItems: 'center', padding: 40, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  exploreBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.pill, marginTop: 20 },
  exploreText: { color: '#fff', fontWeight: '700' },
  thread: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: '#fff', borderRadius: Radius.lg, ...Shadow.card, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  otherName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  time: { fontSize: 11, color: Colors.textTertiary },
  lastMsg: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
});
