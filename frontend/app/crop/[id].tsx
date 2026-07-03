import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Linking, Alert, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { Colors, Radius, Shadow } from '@/src/theme';

const { width: WIN_W } = Dimensions.get('window');

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function gradeColor(g?: string) {
  if (!g) return '#6B7280';
  if (g === 'Grade A' || g === 'Export Quality') return '#059669';
  if (g === 'Organic Certified') return '#7C3AED';
  if (g === 'Grade B') return '#0284C7';
  return '#6B7280';
}

export default function CropDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [data, setData] = useState<{ listing: any; seller: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [inquiryOpen, setInquiryOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.crop(id as string);
        setData(r);
      } catch (e: any) {
        Alert.alert('Not found', 'This listing may have been removed.', [{ text: 'Back', onPress: () => router.back() }]);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 80 }} color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }
  if (!data) return null;

  const { listing, seller } = data;
  const images: string[] = (listing.images && listing.images.length > 0) ? listing.images : (listing.image ? [listing.image] : []);
  const gColor = gradeColor(listing.quality_grade);

  const onCall = () => {
    const phone = seller?.phone || listing?.seller_phone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert('Phone not available', 'Please use Inquire button to reach out via message.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.gallery}>
          <ScrollView
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActiveImg(Math.round(e.nativeEvent.contentOffset.x / WIN_W))}
          >
            {images.length === 0 ? (
              <View style={[styles.galleryImg, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="leaf" size={80} color={Colors.textTertiary} />
              </View>
            ) : images.map((src, i) => (
              <Image key={i} source={{ uri: src }} style={styles.galleryImg} />
            ))}
          </ScrollView>
          <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={styles.topGrad}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtnGlass}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.iconBtnGlass}>
                <Ionicons name="heart-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtnGlass}>
                <Ionicons name="share-social" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          {images.length > 1 && (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, activeImg === i && styles.dotActive]} />
              ))}
            </View>
          )}
          {/* Grade badge on image */}
          {listing.quality_grade && (
            <View style={[styles.gradeBadgeLg, { backgroundColor: gColor }]}>
              <Ionicons name="ribbon" size={13} color="#fff" />
              <Text style={styles.gradeBadgeLgText}>{listing.quality_grade}</Text>
            </View>
          )}
        </View>

        {/* Header */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.crop}>{listing.crop}</Text>
              {listing.crop_variety ? (
                <Text style={styles.variety}>Variety · {listing.crop_variety}</Text>
              ) : null}
              <View style={styles.locRow}>
                <Ionicons name="location" size={13} color={Colors.textSecondary} />
                <Text style={styles.locText}>{listing.location}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>₹{listing.expected_price?.toLocaleString()}</Text>
              <Text style={styles.perUnit}>per {listing.unit}</Text>
              {listing.negotiable && (
                <View style={styles.negBadge}><Text style={styles.negBadgeText}>Negotiable</Text></View>
              )}
            </View>
          </View>

          {/* Trust badges row */}
          <View style={styles.trustRow}>
            {listing.lab_tested && <TrustBadge icon="flask" label="Lab Tested" color="#0EA5E9" />}
            {listing.delivery_available && <TrustBadge icon="car" label="Delivery" color={Colors.info} />}
            {listing.pickup_available && <TrustBadge icon="business" label="Pickup" color={Colors.primary} />}
            {listing.certificate_url && <TrustBadge icon="document-attach" label="Certified" color="#7C3AED" />}
          </View>
        </View>

        {/* Key specs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Details</Text>
          <View style={styles.specGrid}>
            <SpecItem icon="calendar" label="Harvest Date" value={formatDate(listing.harvest_date)} />
            <SpecItem icon="layers" label="Available" value={listing.available_quantity ? `${listing.available_quantity} ${listing.unit}` : `${listing.quantity} ${listing.unit}`} />
            <SpecItem icon="cube" label="MOQ" value={listing.minimum_order_quantity ? `${listing.minimum_order_quantity} ${listing.minimum_order_unit || listing.unit}` : '—'} />
            {listing.moisture_percentage != null && (
              <SpecItem icon="water" label="Moisture" value={`${listing.moisture_percentage}%`} />
            )}
            {listing.packaging_type && (
              <SpecItem icon="cube-outline" label="Packaging" value={listing.packaging_type} />
            )}
            {listing.storage_condition && (
              <SpecItem icon="snow" label="Storage" value={listing.storage_condition} />
            )}
            {listing.expected_delivery_days != null && (
              <SpecItem icon="time" label="Delivery in" value={`${listing.expected_delivery_days} days`} />
            )}
            {listing.preferred_payment && (
              <SpecItem icon="card" label="Payment" value={listing.preferred_payment} />
            )}
          </View>
        </View>

        {/* Description */}
        {listing.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About This Crop</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </View>
        ) : null}

        {/* Certificate */}
        {listing.certificate_url ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quality Certificate</Text>
            <TouchableOpacity style={styles.certBtn} onPress={() => Linking.openURL(listing.certificate_url)}>
              <Ionicons name="document-attach" size={20} color={Colors.primary} />
              <Text style={styles.certBtnText}>View Certificate</Text>
              <Ionicons name="open-outline" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Seller */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seller Information</Text>
          <TouchableOpacity
            style={styles.sellerCard}
            onPress={() => listing.seller_id && router.push(`/seller/${listing.seller_id}` as any)}
            testID="crop-detail-seller"
          >
            <Image
              source={{ uri: seller?.picture || listing.seller_picture || `https://i.pravatar.cc/150?u=${listing.seller_id}` }}
              style={styles.sellerPic}
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sellerName}>{seller?.name || listing.seller_name || 'Farmer'}</Text>
                {(seller?.verified || listing.seller_verified) && (
                  <View style={styles.vChip}>
                    <Ionicons name="checkmark-circle" size={11} color="#fff" />
                    <Text style={styles.vChipText}>Verified</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <SmallStat icon="star" value={String(seller?.seller_rating ?? 4.6)} color="#F59E0B" />
                <SmallStat icon="basket" value={`${seller?.listings_count ?? '—'} listings`} color={Colors.primary} />
                <SmallStat icon="checkmark-done" value={`${seller?.completed_trades ?? 0} trades`} color={Colors.info} />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Safety note */}
        <View style={[styles.section, { marginBottom: 20 }]}>
          <View style={styles.safetyNote}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.info} />
            <Text style={styles.safetyText}>
              For your safety, negotiate & complete payments through Cropido's inquiry chat. Never share OTPs or make advance payments outside the platform.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.callBtn} onPress={onCall}>
          <Ionicons name="call" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.inquireCta}
          onPress={() => {
            if (!user) { router.push('/(auth)/login' as any); return; }
            setInquiryOpen(true);
          }}
          testID="crop-detail-inquire"
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
          <Text style={styles.inquireCtaText}>Send Inquiry</Text>
        </TouchableOpacity>
      </View>

      <InquirySheet
        visible={inquiryOpen}
        listing={listing}
        onClose={() => setInquiryOpen(false)}
        onSent={() => {
          setInquiryOpen(false);
          Alert.alert('Inquiry sent ✅', 'Continue chat in Messages.', [
            { text: 'Open Messages', onPress: () => router.push('/messages' as any) },
            { text: 'OK', style: 'cancel' },
          ]);
        }}
      />
    </SafeAreaView>
  );
}

// ---------- Sub components ----------
function TrustBadge({ icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <View style={[styles.trustBadge, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.trustBadgeText, { color }]}>{label}</Text>
    </View>
  );
}
function SpecItem({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.specItem}>
      <View style={styles.specIcon}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}
function SmallStat({ icon, value, color }: { icon: any; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={{ fontSize: 11, color: Colors.textSecondary, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

function InquirySheet({ visible, listing, onClose, onSent }: any) {
  const [qty, setQty] = useState('');
  const [offer, setOffer] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible && listing) {
      setQty(String(listing.minimum_order_quantity || ''));
      setOffer(String(listing.expected_price || ''));
      setMsg('');
    }
  }, [visible, listing]);

  const send = async () => {
    setSending(true);
    try {
      await api.cropInquiry({
        listing_id: listing.listing_id,
        quantity: qty ? parseFloat(qty) : undefined,
        offered_price: offer ? parseFloat(offer) : undefined,
        message: msg,
      });
      onSent();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Please try again');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textPrimary} /></TouchableOpacity>
            <Text style={styles.sheetTitle}>Send Inquiry</Text>
            <View style={{ width: 30 }} />
          </View>
          <View style={{ padding: 20, gap: 12 }}>
            <View style={{ marginBottom: 4 }}>
              <Text style={styles.fLabel}>Quantity needed ({listing?.minimum_order_unit || listing?.unit})</Text>
              <TextInput keyboardType="numeric" value={qty} onChangeText={setQty} style={styles.input}
                placeholder={`Min ${listing?.minimum_order_quantity || '—'}`} placeholderTextColor={Colors.textTertiary} />
            </View>
            {listing?.negotiable ? (
              <View>
                <Text style={styles.fLabel}>Your offer (₹ / unit)</Text>
                <TextInput keyboardType="numeric" value={offer} onChangeText={setOffer} style={styles.input}
                  placeholder={`Listed: ₹${listing.expected_price}`} placeholderTextColor={Colors.textTertiary} />
              </View>
            ) : null}
            <View>
              <Text style={styles.fLabel}>Message to seller</Text>
              <TextInput multiline value={msg} onChangeText={setMsg} style={[styles.input, { minHeight: 90 }]}
                placeholder="Requirements, delivery timeline, packaging preference..." placeholderTextColor={Colors.textTertiary} />
            </View>
            <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending} testID="crop-inquiry-send">
              {sending ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#fff" />
                  <Text style={styles.sendBtnText}>Send to Seller</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  gallery: { width: '100%', height: 320, backgroundColor: '#000' },
  galleryImg: { width: WIN_W, height: 320 },
  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtnGlass: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 20, backgroundColor: '#fff' },
  gradeBadgeLg: { position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  gradeBadgeLgText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },

  section: { backgroundColor: '#fff', marginTop: 10, paddingHorizontal: 20, paddingVertical: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10, letterSpacing: -0.2 },
  crop: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  variety: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, fontWeight: '600' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  price: { fontSize: 22, fontWeight: '900', color: Colors.secondary },
  perUnit: { fontSize: 11, color: Colors.textTertiary, marginTop: -2 },
  negBadge: { marginTop: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  negBadgeText: { color: '#B45309', fontSize: 10, fontWeight: '800' },

  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  trustBadgeText: { fontSize: 11, fontWeight: '800' },

  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  specItem: { width: '48%', flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10, backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.md },
  specIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  specLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  specValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '700', marginTop: 2 },
  description: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  certBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: Colors.primary + '10', borderRadius: Radius.md },
  certBtnText: { flex: 1, color: Colors.primary, fontWeight: '700', fontSize: 13 },

  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.md },
  sellerPic: { width: 52, height: 52, borderRadius: 26 },
  sellerName: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  vChip: { flexDirection: 'row', gap: 3, alignItems: 'center', backgroundColor: Colors.info, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  vChipText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  safetyNote: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#EFF6FF', borderRadius: Radius.md, borderLeftWidth: 3, borderLeftColor: Colors.info },
  safetyText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.border },
  callBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  inquireCta: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 14, ...Shadow.floating },
  inquireCtaText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  fLabel: { fontSize: 12, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  input: { backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.textPrimary },
  sendBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 14, marginTop: 6 },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
