import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Modal, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/contexts/AuthContext';
import { useApp } from '@/src/contexts/AppContext';
import { api } from '@/src/api/client';
import { Colors, Radius, Shadow } from '@/src/theme';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, refresh, logout } = useAuth();
  const { themeMode, setThemeMode } = useApp();
  const [picSheet, setPicSheet] = useState(false);
  const [uploading, setUploading] = useState(false);

  const resolvedPic = user?.picture || 'https://i.pravatar.cc/300?u=' + user?.user_id;

  const uploadPicture = async (base64: string | null) => {
    setUploading(true);
    setPicSheet(false);
    try {
      await api.updateProfile({ picture: base64 });
      await refresh();
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Could not update profile picture');
    } finally {
      setUploading(false);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert('Permission denied', 'Please enable photo access in Settings to change your picture.', [
          { text: 'Cancel' },
          { text: 'Open Settings', onPress: () => Platform.OS !== 'web' && import('react-native').then(({ Linking }) => Linking.openSettings()) },
        ]);
      } else {
        Alert.alert('Permission required', 'Cropido needs access to your photos to update your picture.');
      }
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    await uploadPicture(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert('Permission denied', 'Please enable camera access in Settings to take a photo.', [
          { text: 'Cancel' },
          { text: 'Open Settings', onPress: () => Platform.OS !== 'web' && import('react-native').then(({ Linking }) => Linking.openSettings()) },
        ]);
      } else {
        Alert.alert('Camera required', 'Cropido needs camera access to take your photo.');
      }
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    await uploadPicture(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const removePicture = () => {
    Alert.alert('Remove photo?', 'Your default avatar will be shown.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => uploadPicture(null) },
    ]);
  };

  const items = [
    { key: 'orders', icon: 'receipt' as const, label: t('profile.myOrders'), route: '/orders' as const },
    { key: 'sub', icon: 'ribbon' as const, label: t('profile.subscription'), route: '/subscription' as const, badge: user?.subscription?.toUpperCase() },
    { key: 'payments', icon: 'card' as const, label: t('profile.payments'), route: '/payments' as const },
    ...(user?.role === 'admin' ? [{ key: 'admin', icon: 'shield' as const, label: 'Admin Console', route: '/admin' as const, badge: 'ADMIN' }] : []),
    { key: 'lang', icon: 'language' as const, label: t('profile.language'), route: '/settings' as const },
    { key: 'settings', icon: 'settings' as const, label: t('profile.settings'), route: '/settings' as const },
    { key: 'help', icon: 'help-circle' as const, label: t('profile.help'), route: '/settings' as const },
    { key: 'about', icon: 'information-circle' as const, label: t('profile.about'), route: '/settings' as const },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[Colors.primary, Colors.primary700]} style={styles.headerGrad}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => setPicSheet(true)}
            activeOpacity={0.85}
            testID="profile-avatar-edit"
          >
            <Image source={{ uri: resolvedPic }} style={styles.avatar} />
            {uploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}
            {user?.verified && !uploading && (
              <View style={styles.verified}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{user?.role?.toUpperCase()} · {user?.email}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>12</Text><Text style={styles.statLabel}>Listings</Text></View>
            <View style={styles.divider} />
            <View style={styles.stat}><Text style={styles.statValue}>48</Text><Text style={styles.statLabel}>Orders</Text></View>
            <View style={styles.divider} />
            <View style={styles.stat}><Text style={styles.statValue}>245</Text><Text style={styles.statLabel}>Community</Text></View>
          </View>
        </LinearGradient>

        <TouchableOpacity style={styles.upgradeCard} onPress={() => router.push('/subscription')} testID="profile-upgrade-card">
          <View style={styles.upgradeIcon}><Ionicons name="rocket" size={20} color={Colors.secondary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.upgradeTitle}>Upgrade to Pro Farmer</Text>
            <Text style={styles.upgradeSub}>Unlimited AI, advanced insights & priority support</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.rowItem}>
            <View style={styles.rowIcon}><Ionicons name="moon" size={18} color={Colors.textPrimary} /></View>
            <Text style={styles.rowLabel}>{t('profile.darkMode')}</Text>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor="#fff"
              testID="profile-dark-mode-toggle"
            />
          </View>

          {items.map((it) => (
            <TouchableOpacity
              key={it.key}
              style={styles.rowItem}
              onPress={() => router.push(it.route)}
              testID={`profile-item-${it.key}`}
            >
              <View style={styles.rowIcon}><Ionicons name={it.icon} size={18} color={Colors.textPrimary} /></View>
              <Text style={styles.rowLabel}>{it.label}</Text>
              {it.badge && <View style={styles.badgePill}><Text style={styles.badgeText}>{it.badge}</Text></View>}
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.rowItem, { borderTopWidth: 6, borderTopColor: Colors.surfaceSubtle }]}
            onPress={logout}
            testID="profile-logout-button"
          >
            <View style={[styles.rowIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="log-out" size={18} color={Colors.error} />
            </View>
            <Text style={[styles.rowLabel, { color: Colors.error, fontWeight: '700' }]}>{t('common.logout')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Cropido v1.0 · Made with ❤️ for Indian farmers</Text>
      </ScrollView>

      {/* Change picture sheet */}
      <Modal visible={picSheet} transparent animationType="slide" onRequestClose={() => setPicSheet(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPicSheet(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Update Profile Picture</Text>
            <Text style={styles.sheetSub}>Choose an option to update your photo</Text>

            <TouchableOpacity style={styles.optionRow} onPress={takePhoto} testID="pic-opt-camera">
              <View style={[styles.optionIcon, { backgroundColor: Colors.primary + '15' }]}>
                <Ionicons name="camera" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>Take a Photo</Text>
                <Text style={styles.optionSub}>Use your camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={pickFromGallery} testID="pic-opt-gallery">
              <View style={[styles.optionIcon, { backgroundColor: Colors.info + '15' }]}>
                <Ionicons name="image" size={20} color={Colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>Choose from Gallery</Text>
                <Text style={styles.optionSub}>Pick an existing photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            {user?.picture ? (
              <TouchableOpacity style={styles.optionRow} onPress={removePicture} testID="pic-opt-remove">
                <View style={[styles.optionIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="trash" size={20} color={Colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: Colors.error }]}>Remove Photo</Text>
                  <Text style={styles.optionSub}>Revert to default avatar</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPicSheet(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  headerGrad: { padding: 24, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#fff' },
  verified: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.info, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  role: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, letterSpacing: 0.4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  divider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.25)' },
  upgradeCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: '#fff', borderRadius: Radius.lg,
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadow.card,
    borderWidth: 1, borderColor: Colors.secondary100,
  },
  upgradeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondary50, alignItems: 'center', justifyContent: 'center' },
  upgradeTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  upgradeSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  section: { marginTop: 20, backgroundColor: '#fff', marginHorizontal: 20, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: Colors.primary50 },
  badgeText: { color: Colors.primary, fontSize: 10, fontWeight: '700' },
  version: { textAlign: 'center', color: Colors.textTertiary, fontSize: 12, marginTop: 30 },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#fff', ...Shadow.floating },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 45, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  sheetSub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 14, color: Colors.textPrimary, fontWeight: '700' },
  optionSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  cancelBtn: { marginTop: 14, paddingVertical: 14, borderRadius: Radius.pill, backgroundColor: Colors.surfaceSubtle, alignItems: 'center' },
  cancelBtnText: { color: Colors.textPrimary, fontWeight: '800', fontSize: 14 },
});
