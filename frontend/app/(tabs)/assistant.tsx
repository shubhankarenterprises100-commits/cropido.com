import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api/client';
import { useApp } from '@/src/contexts/AppContext';
import { Colors, Radius, Shadow } from '@/src/theme';

type Msg = { role: 'user' | 'assistant'; text: string; image?: string };

const SUGGESTIONS = [
  { icon: 'leaf' as const, text: 'How to control leaf blight in rice?' },
  { icon: 'sunny' as const, text: 'Best crops for summer in Maharashtra?' },
  { icon: 'water' as const, text: 'Drip irrigation cost per acre?' },
  { icon: 'trending-up' as const, text: 'Wheat market outlook 2026' },
];

export default function Assistant() {
  const { t } = useTranslation();
  const { language } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', text: t('ai.welcomeMsg') }]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<{ base64: string; uri: string } | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const sessionId = useRef(`s_${Date.now()}`);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs, sending]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6,
    });
    if (!r.canceled && r.assets[0]?.base64) {
      setImage({ base64: r.assets[0].base64, uri: r.assets[0].uri });
    }
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message && !image) return;
    const userMsg: Msg = { role: 'user', text: message, image: image?.uri };
    setMsgs((m) => [...m, userMsg]);
    setInput('');
    const attachedImg = image?.base64;
    setImage(null);
    setSending(true);
    try {
      const r = await api.aiChat(sessionId.current, message || 'Please analyze this crop image.', language, attachedImg);
      setMsgs((m) => [...m, { role: 'assistant', text: r.reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'assistant', text: `Sorry, I ran into an error: ${e.message}` }]);
    }
    setSending(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#8B5CF6', '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiAvatar}><Ionicons name="sparkles" size={20} color="#fff" /></View>
          <View>
            <Text style={styles.title}>{t('ai.title')}</Text>
            <Text style={styles.subtitle}>Powered by Claude Sonnet 4.5 · {language.toUpperCase()}</Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
        style={{ flex: 1 }}
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {msgs.map((m, i) => (
            <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.userRow : styles.aiRow]}>
              {m.role === 'assistant' && <View style={styles.miniAvatar}><Ionicons name="sparkles" size={12} color="#fff" /></View>}
              <View style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                {m.image && <Image source={{ uri: m.image }} style={styles.msgImage} />}
                {m.text ? <Text style={[styles.msgText, m.role === 'user' && { color: '#fff' }]}>{m.text}</Text> : null}
              </View>
            </View>
          ))}
          {sending && (
            <View style={[styles.bubbleRow, styles.aiRow]}>
              <View style={styles.miniAvatar}><Ionicons name="sparkles" size={12} color="#fff" /></View>
              <View style={[styles.bubble, styles.aiBubble, styles.typing]}>
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text style={styles.msgText}>{t('ai.typing')}</Text>
              </View>
            </View>
          )}

          {msgs.length === 1 && (
            <View style={styles.suggestBox}>
              <Text style={styles.suggestTitle}>Try asking</Text>
              <View style={styles.suggestGrid}>
                {SUGGESTIONS.map((s, i) => (
                  <TouchableOpacity key={i} style={styles.suggestChip} onPress={() => send(s.text)} testID={`ai-suggest-${i}`}>
                    <Ionicons name={s.icon} size={14} color={Colors.primary} />
                    <Text style={styles.suggestText}>{s.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputWrap}>
          {image && (
            <View style={styles.imgPreview}>
              <Image source={{ uri: image.uri }} style={styles.previewImg} />
              <TouchableOpacity onPress={() => setImage(null)} style={styles.removeImg}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity onPress={pickImage} style={styles.attachBtn} testID="ai-attach-button">
              <Ionicons name="image" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              placeholder={t('ai.placeholder')}
              placeholderTextColor={Colors.textTertiary}
              value={input}
              onChangeText={setInput}
              multiline
              style={styles.input}
              testID="ai-input"
            />
            <TouchableOpacity onPress={() => send()} disabled={sending || (!input.trim() && !image)} style={styles.sendBtn} testID="ai-send-button">
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 20, gap: 10 },
  bubbleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  userBubble: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, ...Shadow.card },
  msgText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  msgImage: { width: 180, height: 120, borderRadius: 10, marginBottom: 6 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestBox: { marginTop: 20 },
  suggestTitle: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  suggestGrid: { gap: 8 },
  suggestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  suggestText: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  inputWrap: { padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border },
  imgPreview: { alignSelf: 'flex-start', marginBottom: 8, position: 'relative' },
  previewImg: { width: 60, height: 60, borderRadius: 10 },
  removeImg: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.xl, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, maxHeight: 100, minHeight: 40,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
});
