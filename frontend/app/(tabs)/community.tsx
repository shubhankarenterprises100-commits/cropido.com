import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput,
  RefreshControl, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { Colors, Radius, Shadow } from '@/src/theme';

const TABS = ['feed', 'communities', 'experts', 'trending'] as const;

export default function Community() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<typeof TABS[number]>('feed');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [newPost, setNewPost] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.posts(tab);
      setPosts(r.posts);
    } catch (e) { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const like = async (postId: string) => {
    try {
      const r = await api.likePost(postId);
      setPosts((ps) => ps.map((p) => p.post_id === postId ? { ...p, likes_count: r.likes_count } : p));
    } catch {}
  };

  const submitPost = async () => {
    if (!newPost.trim()) return;
    try {
      await api.createPost({ content: newPost, tags: [] });
      setNewPost('');
      setComposeOpen(false);
      load();
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('community.title')}</Text>
        <TouchableOpacity style={styles.composeBtn} onPress={() => setComposeOpen(true)} testID="community-compose-button">
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((tk) => (
          <TouchableOpacity
            key={tk}
            style={[styles.tab, tab === tk && styles.tabActive]}
            onPress={() => setTab(tk)}
            testID={`community-tab-${tk}`}
          >
            <Text style={[styles.tabText, tab === tk && styles.tabTextActive]}>
              {t(`community.${tk}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : posts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        ) : posts.map((p) => (
          <View key={p.post_id} style={styles.postCard} testID={`community-post-${p.post_id}`}>
            <View style={styles.postHeader}>
              <Image source={{ uri: p.user_picture || 'https://i.pravatar.cc/150' }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{p.user_name}</Text>
                  {p.is_expert && (
                    <View style={styles.expertBadge}>
                      <Ionicons name="ribbon" size={10} color={Colors.info} />
                      <Text style={styles.expertText}>Expert</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.postTime}>{p.created_at?.substring(0, 10)}</Text>
              </View>
              <TouchableOpacity><Ionicons name="ellipsis-horizontal" size={18} color={Colors.textTertiary} /></TouchableOpacity>
            </View>
            <Text style={styles.postContent}>{p.content}</Text>
            {p.image && <Image source={{ uri: p.image }} style={styles.postImage} />}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => like(p.post_id)} testID={`post-like-${p.post_id}`}>
                <Ionicons name="heart-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.actionText}>{p.likes_count}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Ionicons name="chatbubble-outline" size={17} color={Colors.textSecondary} />
                <Text style={styles.actionText}>{p.comments_count}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Ionicons name="share-social-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.actionText}>{p.shares_count || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginLeft: 'auto' }}>
                <Ionicons name="bookmark-outline" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Compose modal */}
      <Modal visible={composeOpen} animationType="slide" transparent onRequestClose={() => setComposeOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setComposeOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Image source={{ uri: user?.picture || 'https://i.pravatar.cc/150' }} style={styles.avatar} />
              <Text style={styles.modalName}>{user?.name}</Text>
            </View>
            <TextInput
              placeholder={t('community.createPost')}
              placeholderTextColor={Colors.textTertiary}
              value={newPost}
              onChangeText={setNewPost}
              multiline
              style={styles.modalInput}
              testID="community-compose-input"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setComposeOpen(false)}><Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={submitPost} style={styles.modalPost} testID="community-compose-submit">
                <Text style={{ color: '#fff', fontWeight: '700' }}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  composeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.floating },
  tabsRow: { paddingHorizontal: 20, gap: 8, height: 56, alignItems: 'center', backgroundColor: '#fff' },
  tab: { height: 36, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  postCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: Radius.lg, padding: 14, ...Shadow.card },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  expertBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  expertText: { fontSize: 10, color: Colors.info, fontWeight: '700' },
  postTime: { fontSize: 11, color: Colors.textTertiary },
  postContent: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginTop: 10 },
  postImage: { width: '100%', height: 200, borderRadius: 12, marginTop: 10, backgroundColor: Colors.surfaceSubtle },
  actions: { flexDirection: 'row', gap: 20, marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 60 },
  emptyText: { color: Colors.textSecondary, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  modalName: { fontWeight: '700', color: Colors.textPrimary },
  modalInput: { minHeight: 120, fontSize: 15, color: Colors.textPrimary, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  modalPost: { backgroundColor: Colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.pill },
});
