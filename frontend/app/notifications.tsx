import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await api.notifications(); setItems(r.notifications); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await api.markAllRead();
    setItems((its) => its.map((i) => ({ ...i, read: true })));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={20} color={Colors.textPrimary} /></TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={markAllRead} testID="notif-mark-all"><Text style={styles.markAll}>Mark all read</Text></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {items.map((n) => (
            <View key={n.notif_id} style={[styles.card, !n.read && styles.cardUnread]}>
              <View style={styles.iconWrap}>
                <Ionicons name={n.icon as any} size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifBody}>{n.body}</Text>
                <Text style={styles.notifTime}>{n.created_at?.substring(0, 10)}</Text>
              </View>
              {!n.read && <View style={styles.unreadDot} />}
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
  markAll: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  card: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: '#fff', borderRadius: Radius.lg, ...Shadow.card },
  cardUnread: { backgroundColor: Colors.primary50 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...Shadow.card },
  notifTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  notifBody: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  notifTime: { fontSize: 11, color: Colors.textTertiary, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error, marginTop: 6 },
});
