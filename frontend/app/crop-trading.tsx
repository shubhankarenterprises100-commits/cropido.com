import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, RefreshControl, FlatList, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { Colors, Radius, Shadow } from '@/src/theme';

const CATEGORIES = [
  { code: 'all', label: 'All', icon: 'apps' },
  { code: 'rice', label: 'Rice', icon: 'restaurant' },
  { code: 'wheat', label: 'Wheat', icon: 'nutrition' },
  { code: 'vegetables', label: 'Vegetables', icon: 'leaf' },
  { code: 'fruits', label: 'Fruits', icon: 'flower' },
  { code: 'pulses', label: 'Pulses', icon: 'egg' },
  { code: 'spices', label: 'Spices', icon: 'flame' },
] as const;

const GRADES = ['Grade A', 'Grade B', 'Grade C', 'Export Quality', 'Organic Certified'] as const;
const UNITS = ['kg', 'quintal', 'ton'] as const;
const PAYMENT_METHODS = ['UPI', 'Bank Transfer', 'Cash', 'Cheque'] as const;

const SORTS = [
  { code: 'recent', label: 'Recent' },
  { code: 'price_asc', label: 'Price ↑' },
  { code: 'price_desc', label: 'Price ↓' },
  { code: 'harvest_recent', label: 'Fresh Harvest' },
];

type Listing = {
  listing_id: string;
  crop: string;
  crop_variety?: string;
  category: string;
  quantity: number;
  unit: string;
  expected_price: number;
  location: string;
  negotiable: boolean;
  image?: string;
  images?: string[];
  description?: string;
  seller_name?: string;
  seller_verified?: boolean;
  seller_picture?: string;
  seller_id?: string;
  harvest_date?: string;
  minimum_order_quantity?: number;
  minimum_order_unit?: string;
  quality_grade?: string;
  available_quantity?: number;
  moisture_percentage?: number;
  delivery_available?: boolean;
  pickup_available?: boolean;
  lab_tested?: boolean;
  packaging_type?: string;
  storage_condition?: string;
  expected_delivery_days?: number;
  preferred_payment?: string;
  certificate_url?: string;
};

// ---------- Helpers ----------
function daysAgo(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(+d)) return null;
  return Math.floor((Date.now() - +d) / (1000 * 60 * 60 * 24));
}
function freshnessLabel(iso?: string): { label: string; color: string } | null {
  const d = daysAgo(iso);
  if (d == null) return null;
  if (d <= 7) return { label: 'Fresh Harvest', color: Colors.success };
  if (d <= 30) return { label: `${d}d harvested`, color: Colors.info };
  if (d <= 90) return { label: `${Math.round(d / 30)}mo old`, color: Colors.warning };
  return { label: 'Aged', color: Colors.textTertiary };
}
function gradeColor(g?: string) {
  if (!g) return Colors.textTertiary;
  if (g === 'Grade A' || g === 'Export Quality') return '#059669';
  if (g === 'Organic Certified') return '#7C3AED';
  if (g === 'Grade B') return '#0284C7';
  return '#6B7280';
}
function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function CropTrading() {
  const router = useRouter();
  const { user } = useAuth();

  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [grade, setGrade] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<{ min?: string; max?: string }>({});
  const [showFilters, setShowFilters] = useState(false);

  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [inquiryFor, setInquiryFor] = useState<Listing | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.crops({
        category,
        q: debouncedQ || undefined,
        sort,
        grade: grade || undefined,
        min_price: priceRange.min ? Number(priceRange.min) : undefined,
        max_price: priceRange.max ? Number(priceRange.max) : undefined,
      });
      setItems(r.listings || []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [category, debouncedQ, sort, grade, priceRange]);

  useEffect(() => { load(); }, [load]);

  const activeFilterCount = (grade ? 1 : 0) + (priceRange.min ? 1 : 0) + (priceRange.max ? 1 : 0) + (sort !== 'recent' ? 1 : 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <LinearGradient colors={['#166534', '#065F46']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtnDark} testID="crop-back">
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Crop Trading</Text>
          <Text style={styles.headerSub}>{items.length} listings available</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateOpen(true)} testID="crop-add-button">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* SEARCH BAR */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            placeholder="Search crop, variety, seller..."
            placeholderTextColor={Colors.textTertiary}
            value={q}
            onChangeText={setQ}
            style={styles.searchInput}
            returnKeyType="search"
            testID="crop-search-input"
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          testID="crop-filter-btn"
        >
          <Ionicons name="options" size={18} color={activeFilterCount > 0 ? '#fff' : Colors.textPrimary} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* CATEGORY CHIPS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.code}
            onPress={() => setCategory(c.code)}
            style={[styles.chip, category === c.code && styles.chipActive]}
            testID={`crop-chip-${c.code}`}
          >
            <Ionicons name={c.icon as any} size={13} color={category === c.code ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.chipText, category === c.code && styles.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} size="large" />
      ) : items.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} hasFilters={activeFilterCount > 0 || !!debouncedQ}
          onClear={() => { setQ(''); setGrade(null); setPriceRange({}); setSort('recent'); setCategory('all'); }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.listing_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <CropCard
              item={item}
              onOpen={() => router.push(`/crop/${item.listing_id}` as any)}
              onInquire={() => setInquiryFor(item)}
              onCall={() => {
                if (item.seller_id) {
                  // Placeholder: real phone would come from server
                  Alert.alert('Contact Seller', `${item.seller_name || 'Seller'}\n\nCall feature will connect via secure Cropido contact number.`);
                }
              }}
            />
          )}
        />
      )}

      {/* Modals */}
      <FiltersSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        grade={grade}
        setGrade={setGrade}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        sort={sort}
        setSort={setSort}
        onReset={() => { setGrade(null); setPriceRange({}); setSort('recent'); }}
      />

      <CreateCropModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); }}
        loggedIn={!!user}
        onLogin={() => { setCreateOpen(false); router.push('/(auth)/login' as any); }}
      />

      <InquiryModal
        listing={inquiryFor}
        onClose={() => setInquiryFor(null)}
        onSent={() => setInquiryFor(null)}
        loggedIn={!!user}
        onLogin={() => { setInquiryFor(null); router.push('/(auth)/login' as any); }}
      />
    </SafeAreaView>
  );
}

// =============================================================================
// CROP CARD
// =============================================================================
function CropCard({ item, onOpen, onInquire, onCall }: {
  item: Listing; onOpen: () => void; onInquire: () => void; onCall: () => void;
}) {
  const fresh = freshnessLabel(item.harvest_date);
  const gColor = gradeColor(item.quality_grade);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={styles.card} testID={`crop-card-${item.listing_id}`}>
      <View>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.cardImg} />
        ) : (
          <View style={[styles.cardImg, styles.cardImgFallback]}>
            <Ionicons name="leaf" size={48} color={Colors.textTertiary} />
          </View>
        )}
        {/* Top-left badges */}
        <View style={styles.topBadges}>
          {item.quality_grade && (
            <View style={[styles.gradeBadge, { backgroundColor: gColor }]}>
              <Ionicons name="ribbon" size={11} color="#fff" />
              <Text style={styles.gradeBadgeText}>{item.quality_grade}</Text>
            </View>
          )}
          {item.lab_tested && (
            <View style={[styles.gradeBadge, { backgroundColor: '#0EA5E9' }]}>
              <Ionicons name="flask" size={11} color="#fff" />
              <Text style={styles.gradeBadgeText}>Lab Tested</Text>
            </View>
          )}
        </View>
        {/* Top-right */}
        {fresh && (
          <View style={[styles.freshBadge, { backgroundColor: fresh.color }]}>
            <Ionicons name="time" size={10} color="#fff" />
            <Text style={styles.freshBadgeText}>{fresh.label}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cropName} numberOfLines={1}>{item.crop}</Text>
            {item.crop_variety ? (
              <Text style={styles.varietyText}>Variety · {item.crop_variety}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.priceValue}>₹{item.expected_price.toLocaleString()}</Text>
            <Text style={styles.priceUnit}>per {item.unit}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <MetaItem icon="location-outline" label={item.location} />
          <MetaItem
            icon="cube-outline"
            label={`MOQ ${item.minimum_order_quantity ?? '—'} ${item.minimum_order_unit || item.unit}`}
          />
          {item.available_quantity != null && (
            <MetaItem icon="layers-outline" label={`Avail ${item.available_quantity} ${item.unit}`} />
          )}
          {item.moisture_percentage != null && (
            <MetaItem icon="water-outline" label={`Moisture ${item.moisture_percentage}%`} />
          )}
        </View>

        <View style={styles.logisticsRow}>
          {item.delivery_available && (
            <View style={styles.logChip}><Ionicons name="car" size={10} color={Colors.info} /><Text style={styles.logChipText}>Delivery</Text></View>
          )}
          {item.pickup_available && (
            <View style={styles.logChip}><Ionicons name="business" size={10} color={Colors.primary} /><Text style={styles.logChipText}>Pickup</Text></View>
          )}
          {item.negotiable && (
            <View style={[styles.logChip, { backgroundColor: '#FEF3C7' }]}><Ionicons name="pricetag" size={10} color="#D97706" /><Text style={[styles.logChipText, { color: '#D97706' }]}>Negotiable</Text></View>
          )}
        </View>

        <View style={styles.sellerRow}>
          <Image
            source={{ uri: item.seller_picture || `https://i.pravatar.cc/150?u=${item.seller_id || item.listing_id}` }}
            style={styles.sellerPic}
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.sellerName} numberOfLines={1}>{item.seller_name || 'Farmer'}</Text>
              {item.seller_verified && <Ionicons name="checkmark-circle" size={13} color={Colors.info} />}
            </View>
            <Text style={styles.sellerMeta}>Verified Seller · ★ 4.6</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={onInquire} style={styles.inquireBtn} testID={`crop-inquire-${item.listing_id}`}>
              <Ionicons name="chatbubble-ellipses" size={14} color="#fff" />
              <Text style={styles.inquireBtnText}>Inquire</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MetaItem({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={12} color={Colors.textTertiary} />
      <Text style={styles.metaText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================
function EmptyState({ onCreate, hasFilters, onClear }: { onCreate: () => void; hasFilters: boolean; onClear: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBg}>
        <Ionicons name={hasFilters ? 'search-outline' : 'leaf-outline'} size={54} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{hasFilters ? 'No matching crops' : 'No crops listed yet'}</Text>
      <Text style={styles.emptySub}>
        {hasFilters
          ? 'Try clearing filters or search a different crop / variety.'
          : 'Be the first to list your produce and reach thousands of buyers.'}
      </Text>
      {hasFilters ? (
        <TouchableOpacity style={styles.emptyBtn} onPress={onClear}>
          <Text style={styles.emptyBtnText}>Clear all filters</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.emptyBtn} onPress={onCreate}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.emptyBtnText}>List Your First Crop</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =============================================================================
// FILTERS BOTTOM SHEET
// =============================================================================
function FiltersSheet({ visible, onClose, grade, setGrade, priceRange, setPriceRange, sort, setSort, onReset }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filter & Sort</Text>
            <TouchableOpacity onPress={onReset}><Text style={styles.resetText}>Reset</Text></TouchableOpacity>
          </View>

          <Text style={styles.filterLabel}>Quality Grade</Text>
          <View style={styles.gradeGrid}>
            {GRADES.map((g) => (
              <TouchableOpacity key={g} style={[styles.gradePick, grade === g && { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' }]}
                onPress={() => setGrade(grade === g ? null : g)} testID={`filter-grade-${g}`}>
                <Text style={[styles.gradePickText, grade === g && { color: Colors.primary, fontWeight: '800' }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterLabel}>Price Range (₹ / unit)</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              placeholder="Min"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
              value={priceRange.min || ''}
              onChangeText={(v) => setPriceRange({ ...priceRange, min: v })}
              style={[styles.formInput, { flex: 1 }]}
            />
            <TextInput
              placeholder="Max"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
              value={priceRange.max || ''}
              onChangeText={(v) => setPriceRange({ ...priceRange, max: v })}
              style={[styles.formInput, { flex: 1 }]}
            />
          </View>

          <Text style={styles.filterLabel}>Sort By</Text>
          <View style={styles.gradeGrid}>
            {SORTS.map((s) => (
              <TouchableOpacity key={s.code} style={[styles.gradePick, sort === s.code && { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' }]}
                onPress={() => setSort(s.code)}>
                <Text style={[styles.gradePickText, sort === s.code && { color: Colors.primary, fontWeight: '800' }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
            <Text style={styles.primaryBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// =============================================================================
// CREATE CROP — MULTI-STEP
// =============================================================================
type Draft = {
  crop: string; crop_variety: string; category: string; harvest_date: string;
  location: string; description: string;
  quality_grade: string; minimum_order_quantity: string; minimum_order_unit: string;
  available_quantity: string; unit: string; expected_price: string;
  moisture_percentage: string; lab_tested: boolean; storage_condition: string;
  packaging_type: string; delivery_available: boolean; pickup_available: boolean;
  expected_delivery_days: string; preferred_payment: string; negotiable: boolean;
  certificate_url: string;
  images: string[]; // base64 or URIs
};

const defaultDraft: Draft = {
  crop: '', crop_variety: '', category: 'vegetables', harvest_date: '',
  location: '', description: '',
  quality_grade: 'Grade A', minimum_order_quantity: '', minimum_order_unit: 'quintal',
  available_quantity: '', unit: 'quintal', expected_price: '',
  moisture_percentage: '', lab_tested: false, storage_condition: '',
  packaging_type: '', delivery_available: true, pickup_available: true,
  expected_delivery_days: '', preferred_payment: 'UPI', negotiable: true,
  certificate_url: '',
  images: [],
};

function CreateCropModal({ visible, onClose, onCreated, loggedIn, onLogin }: {
  visible: boolean; onClose: () => void; onCreated: () => void; loggedIn: boolean; onLogin: () => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => { if (visible) { setStep(0); setDraft(defaultDraft); setErrors({}); } }, [visible]);

  const upd = (k: keyof Draft, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  // ---------- Validation ----------
  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!draft.crop.trim()) e.crop = 'Crop name required';
      if (!draft.crop_variety.trim() || draft.crop_variety.trim().length < 2) e.crop_variety = 'Variety min 2 chars';
      if (!draft.harvest_date) e.harvest_date = 'Harvest date required';
      else if (new Date(draft.harvest_date) > new Date()) e.harvest_date = 'Cannot be future date';
      if (!draft.location.trim()) e.location = 'Location required';
    }
    if (s === 1) {
      if (!draft.quality_grade) e.quality_grade = 'Grade required';
      const moq = parseFloat(draft.minimum_order_quantity);
      if (!moq || moq <= 0) e.minimum_order_quantity = 'MOQ must be > 0';
      const avail = parseFloat(draft.available_quantity);
      if (!avail || avail <= 0) e.available_quantity = 'Available qty required';
      if (avail && moq && avail < moq) e.available_quantity = 'Available must be ≥ MOQ';
      const price = parseFloat(draft.expected_price);
      if (!price || price <= 0) e.expected_price = 'Positive price required';
    }
    if (s === 3) {
      if (draft.images.length === 0) e.images = 'At least 1 image required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 4));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow photo library access to add crop images.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsEditing: false,
      selectionLimit: 5 - draft.images.length,
      allowsMultipleSelection: true,
    });
    if (res.canceled) return;
    const b64s = res.assets
      .map((a) => (a.base64 ? `data:image/jpeg;base64,${a.base64}` : null))
      .filter(Boolean) as string[];
    upd('images', [...draft.images, ...b64s].slice(0, 5));
  };

  const submit = async () => {
    if (!validateStep(3)) return;
    setSubmitting(true);
    try {
      await api.createCrop({
        crop: draft.crop.trim(),
        category: draft.category,
        quantity: parseFloat(draft.available_quantity),
        unit: draft.unit,
        expected_price: parseFloat(draft.expected_price),
        location: draft.location.trim(),
        negotiable: draft.negotiable,
        image: draft.images[0],
        images: draft.images,
        description: draft.description.trim(),
        crop_variety: draft.crop_variety.trim(),
        harvest_date: draft.harvest_date,
        minimum_order_quantity: parseFloat(draft.minimum_order_quantity),
        minimum_order_unit: draft.minimum_order_unit,
        quality_grade: draft.quality_grade,
        available_quantity: parseFloat(draft.available_quantity),
        packaging_type: draft.packaging_type.trim() || undefined,
        moisture_percentage: draft.moisture_percentage ? parseFloat(draft.moisture_percentage) : undefined,
        delivery_available: draft.delivery_available,
        pickup_available: draft.pickup_available,
        storage_condition: draft.storage_condition.trim() || undefined,
        expected_delivery_days: draft.expected_delivery_days ? parseInt(draft.expected_delivery_days) : undefined,
        preferred_payment: draft.preferred_payment,
        lab_tested: draft.lab_tested,
        certificate_url: draft.certificate_url.trim() || undefined,
      });
      Alert.alert('Listed! 🌾', 'Your crop is now live in the marketplace.', [{ text: 'Great', onPress: onCreated }]);
    } catch (err: any) {
      Alert.alert('Failed to list crop', err?.message || 'Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loggedIn && visible) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { padding: 24 }]}>
            <Ionicons name="lock-closed" size={48} color={Colors.primary} style={{ alignSelf: 'center' }} />
            <Text style={[styles.sheetTitle, { textAlign: 'center', marginTop: 12 }]}>Login required</Text>
            <Text style={{ textAlign: 'center', color: Colors.textSecondary, marginTop: 6 }}>
              To list crops on Cropido, please sign in as a farmer.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onLogin}>
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 8, padding: 12 }} onPress={onClose}>
              <Text style={{ textAlign: 'center', color: Colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const steps = ['Basics', 'Quality', 'Logistics', 'Media', 'Review'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={[styles.sheet, { maxHeight: '92%' }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textPrimary} /></TouchableOpacity>
            <Text style={styles.sheetTitle}>List Your Crop</Text>
            <Text style={styles.stepBadge}>{step + 1} / 5</Text>
          </View>

          {/* Stepper */}
          <View style={styles.stepperRow}>
            {steps.map((s, i) => (
              <View key={s} style={{ flex: 1, alignItems: 'center' }}>
                <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                  {i < step ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={[styles.stepDotText, i <= step && { color: '#fff' }]}>{i + 1}</Text>}
                </View>
                <Text style={[styles.stepLabel, i === step && { color: Colors.primary, fontWeight: '800' }]}>{s}</Text>
              </View>
            ))}
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {step === 0 && (
              <>
                <Field label="Crop Name *" error={errors.crop}>
                  <TextInput placeholder="e.g., Basmati Rice" placeholderTextColor={Colors.textTertiary}
                    value={draft.crop} onChangeText={(v) => upd('crop', v)} style={styles.formInput} testID="c-crop" />
                </Field>
                <Field label="Variety *" hint="e.g., Pusa 1121, Sonalika, Alphonso" error={errors.crop_variety}>
                  <TextInput placeholder="Variety name" placeholderTextColor={Colors.textTertiary}
                    value={draft.crop_variety} onChangeText={(v) => upd('crop_variety', v)} style={styles.formInput} testID="c-variety" />
                </Field>
                <Field label="Category">
                  <RowPick options={['rice', 'wheat', 'vegetables', 'fruits', 'pulses', 'spices']} value={draft.category} onChange={(v) => upd('category', v)} />
                </Field>
                <Field label="Harvest Date *" hint="When was this harvested?" error={errors.harvest_date}>
                  <TouchableOpacity style={[styles.formInput, { justifyContent: 'center' }]} onPress={() => setShowDatePicker(true)} testID="c-harvest">
                    <Text style={{ color: draft.harvest_date ? Colors.textPrimary : Colors.textTertiary }}>
                      {draft.harvest_date ? formatDate(draft.harvest_date) : 'Select harvest date'}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={draft.harvest_date ? new Date(draft.harvest_date) : new Date()}
                      mode="date"
                      maximumDate={new Date()}
                      onChange={(_, d) => {
                        setShowDatePicker(false);
                        if (d) upd('harvest_date', d.toISOString().slice(0, 10));
                      }}
                    />
                  )}
                </Field>
                <Field label="Location *" error={errors.location}>
                  <TextInput placeholder="e.g., Nashik, Maharashtra" placeholderTextColor={Colors.textTertiary}
                    value={draft.location} onChangeText={(v) => upd('location', v)} style={styles.formInput} testID="c-loc" />
                </Field>
                <Field label="Description">
                  <TextInput placeholder="Any additional details buyers should know..." placeholderTextColor={Colors.textTertiary}
                    value={draft.description} onChangeText={(v) => upd('description', v)} multiline style={[styles.formInput, { minHeight: 70 }]} />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Quality Grade *" error={errors.quality_grade}>
                  <RowPick options={[...GRADES]} value={draft.quality_grade} onChange={(v) => upd('quality_grade', v)} />
                </Field>

                <Field label="Available Quantity *" hint="Total stock available" error={errors.available_quantity}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput placeholder="Qty" placeholderTextColor={Colors.textTertiary}
                      keyboardType="numeric" value={draft.available_quantity}
                      onChangeText={(v) => upd('available_quantity', v)} style={[styles.formInput, { flex: 2 }]} testID="c-avail" />
                    <UnitPicker value={draft.unit} onChange={(v) => upd('unit', v)} style={{ flex: 1 }} />
                  </View>
                </Field>

                <Field label="Minimum Order Quantity *" hint="Smallest quantity buyers can order" error={errors.minimum_order_quantity}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput placeholder="MOQ" placeholderTextColor={Colors.textTertiary}
                      keyboardType="numeric" value={draft.minimum_order_quantity}
                      onChangeText={(v) => upd('minimum_order_quantity', v)} style={[styles.formInput, { flex: 2 }]} testID="c-moq" />
                    <UnitPicker value={draft.minimum_order_unit} onChange={(v) => upd('minimum_order_unit', v)} style={{ flex: 1 }} />
                  </View>
                </Field>

                <Field label="Expected Price * (₹ per unit)" error={errors.expected_price}>
                  <TextInput placeholder="e.g., 4250" placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric" value={draft.expected_price}
                    onChangeText={(v) => upd('expected_price', v)} style={styles.formInput} testID="c-price" />
                </Field>

                <Field label="Moisture %" hint="Optional — for grains & pulses">
                  <TextInput placeholder="e.g., 12" placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric" value={draft.moisture_percentage}
                    onChangeText={(v) => upd('moisture_percentage', v)} style={styles.formInput} />
                </Field>

                <ToggleRow label="Lab Tested" description="Quality lab report available" value={draft.lab_tested} onChange={(v) => upd('lab_tested', v)} />

                <Field label="Storage Condition">
                  <TextInput placeholder="e.g., Dry warehouse, Cold storage" placeholderTextColor={Colors.textTertiary}
                    value={draft.storage_condition} onChangeText={(v) => upd('storage_condition', v)} style={styles.formInput} />
                </Field>

                <Field label="Certificate URL (optional)" hint="Link to lab / organic certificate">
                  <TextInput placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none"
                    value={draft.certificate_url} onChangeText={(v) => upd('certificate_url', v)} style={styles.formInput} />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <ToggleRow label="Delivery Available" description="You can arrange delivery to buyer" value={draft.delivery_available} onChange={(v) => upd('delivery_available', v)} />
                <ToggleRow label="Pickup Available" description="Buyer can pick up from your location" value={draft.pickup_available} onChange={(v) => upd('pickup_available', v)} />
                <ToggleRow label="Negotiable Price" description="Buyers can negotiate the price" value={draft.negotiable} onChange={(v) => upd('negotiable', v)} />

                <Field label="Packaging Type">
                  <TextInput placeholder="e.g., 50 kg PP bags, 10 kg crates" placeholderTextColor={Colors.textTertiary}
                    value={draft.packaging_type} onChangeText={(v) => upd('packaging_type', v)} style={styles.formInput} />
                </Field>
                <Field label="Expected Delivery (days)">
                  <TextInput placeholder="e.g., 5" placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric" value={draft.expected_delivery_days}
                    onChangeText={(v) => upd('expected_delivery_days', v)} style={styles.formInput} />
                </Field>
                <Field label="Preferred Payment">
                  <RowPick options={[...PAYMENT_METHODS]} value={draft.preferred_payment} onChange={(v) => upd('preferred_payment', v)} />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  Add up to 5 crop images. Clear, well-lit photos increase inquiries by 3×.
                </Text>
                {errors.images ? <Text style={styles.errorText}>{errors.images}</Text> : null}
                <View style={styles.imageGrid}>
                  {draft.images.map((img, i) => (
                    <View key={i} style={styles.thumbWrap}>
                      <Image source={{ uri: img }} style={styles.thumb} />
                      {i === 0 && <View style={styles.coverTag}><Text style={styles.coverTagText}>COVER</Text></View>}
                      <TouchableOpacity style={styles.thumbClose} onPress={() => upd('images', draft.images.filter((_, x) => x !== i))}>
                        <Ionicons name="close" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {draft.images.length < 5 && (
                    <TouchableOpacity style={styles.addThumb} onPress={pickImage} testID="c-add-img">
                      <Ionicons name="add" size={30} color={Colors.primary} />
                      <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '700' }}>Add photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {step === 4 && (
              <View style={{ paddingBottom: 20 }}>
                <View style={styles.reviewCard}>
                  {draft.images[0] && <Image source={{ uri: draft.images[0] }} style={styles.reviewImg} />}
                  <Text style={styles.reviewCrop}>{draft.crop}</Text>
                  <Text style={styles.reviewVariety}>Variety · {draft.crop_variety}</Text>
                  <View style={styles.reviewGrid}>
                    <ReviewItem label="Grade" value={draft.quality_grade} />
                    <ReviewItem label="Harvest" value={formatDate(draft.harvest_date)} />
                    <ReviewItem label="Available" value={`${draft.available_quantity} ${draft.unit}`} />
                    <ReviewItem label="MOQ" value={`${draft.minimum_order_quantity} ${draft.minimum_order_unit}`} />
                    <ReviewItem label="Price" value={`₹${draft.expected_price} / ${draft.unit}`} />
                    <ReviewItem label="Location" value={draft.location} />
                    <ReviewItem label="Delivery" value={draft.delivery_available ? 'Yes' : 'No'} />
                    <ReviewItem label="Pickup" value={draft.pickup_available ? 'Yes' : 'No'} />
                    {draft.moisture_percentage ? <ReviewItem label="Moisture" value={`${draft.moisture_percentage}%`} /> : null}
                    {draft.lab_tested ? <ReviewItem label="Lab Tested" value="✓" /> : null}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.footerRow}>
            {step > 0 && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={prev} disabled={submitting}>
                <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            {step < 4 ? (
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={next} testID={`c-next-${step}`}>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={submit} disabled={submitting} testID="c-submit">
                {submitting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.primaryBtnText}>Publish Listing</Text>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// =============================================================================
// INQUIRY SHEET
// =============================================================================
function InquiryModal({ listing, onClose, onSent, loggedIn, onLogin }: {
  listing: Listing | null; onClose: () => void; onSent: () => void; loggedIn: boolean; onLogin: () => void;
}) {
  const [qty, setQty] = useState('');
  const [offer, setOffer] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (listing) {
      setQty(String(listing.minimum_order_quantity || ''));
      setOffer(String(listing.expected_price || ''));
      setMsg('');
    }
  }, [listing]);

  if (!listing) return null;

  const send = async () => {
    if (!loggedIn) { onLogin(); return; }
    setSending(true);
    try {
      await api.cropInquiry({
        listing_id: listing.listing_id,
        quantity: qty ? parseFloat(qty) : undefined,
        offered_price: offer ? parseFloat(offer) : undefined,
        message: msg,
      });
      Alert.alert('Inquiry sent ✅', 'The seller has been notified. Continue the conversation in your Messages.', [{ text: 'OK', onPress: onSent }]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Please try again');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!listing} animationType="slide" transparent onRequestClose={onClose}>
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
            <View style={styles.inqHeader}>
              {listing.image && <Image source={{ uri: listing.image }} style={styles.inqImg} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.cropName}>{listing.crop}</Text>
                {listing.crop_variety ? <Text style={styles.varietyText}>{listing.crop_variety}</Text> : null}
                <Text style={{ color: Colors.secondary, fontWeight: '800', marginTop: 4 }}>
                  ₹{listing.expected_price} / {listing.unit}
                </Text>
              </View>
            </View>

            <Field label={`Quantity needed (${listing.minimum_order_unit || listing.unit})`}>
              <TextInput keyboardType="numeric" value={qty} onChangeText={setQty} style={styles.formInput}
                placeholder={`Min ${listing.minimum_order_quantity ?? '—'}`} placeholderTextColor={Colors.textTertiary} />
            </Field>

            {listing.negotiable ? (
              <Field label="Your offer (₹ / unit)" hint="Seller has marked this as negotiable">
                <TextInput keyboardType="numeric" value={offer} onChangeText={setOffer} style={styles.formInput}
                  placeholder={`Listed: ₹${listing.expected_price}`} placeholderTextColor={Colors.textTertiary} />
              </Field>
            ) : null}

            <Field label="Message">
              <TextInput multiline value={msg} onChangeText={setMsg} style={[styles.formInput, { minHeight: 80 }]}
                placeholder="Share requirements, delivery timeline, packaging preference..." placeholderTextColor={Colors.textTertiary} />
            </Field>

            <TouchableOpacity style={styles.primaryBtn} onPress={send} disabled={sending} testID="inq-send">
              {sending ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Send Inquiry</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// =============================================================================
// SMALL SUB-COMPONENTS
// =============================================================================
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}
function RowPick({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {options.map((o) => (
        <TouchableOpacity key={o} onPress={() => onChange(o)}
          style={[styles.chipPick, value === o && styles.chipPickActive]}>
          <Text style={[styles.chipPickText, value === o && { color: '#fff', fontWeight: '800' }]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
function UnitPicker({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[{ position: 'relative' }, style]}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={[styles.formInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Text style={{ color: Colors.textPrimary }}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          {UNITS.map((u) => (
            <TouchableOpacity key={u} onPress={() => { onChange(u); setOpen(false); }} style={styles.dropdownItem}>
              <Text style={[styles.dropdownItemText, value === u && { fontWeight: '800', color: Colors.primary }]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
function ToggleRow({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: Colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{label}</Text>
        {description ? <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>{description}</Text> : null}
      </View>
      <View style={[styles.toggleBg, value && { backgroundColor: Colors.primary }]}>
        <View style={[styles.toggleKnob, value && { alignSelf: 'flex-end' }]} />
      </View>
    </TouchableOpacity>
  );
}
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewItem}>
      <Text style={styles.reviewItemLabel}>{label}</Text>
      <Text style={styles.reviewItemValue}>{value || '—'}</Text>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceSubtle },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  iconBtnDark: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', ...Shadow.floating },

  searchWrap: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#fff' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.pill, paddingHorizontal: 14, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  filterBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#F59E0B', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  chipsRow: { paddingHorizontal: 16, gap: 8, height: 52, alignItems: 'center', backgroundColor: '#fff' },
  chip: { flexDirection: 'row', gap: 5, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: '#fff' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  chipTextActive: { color: '#fff' },

  // Card
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
  cardImg: { width: '100%', height: 160, backgroundColor: Colors.surfaceSubtle },
  cardImgFallback: { alignItems: 'center', justifyContent: 'center' },
  topBadges: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 },
  gradeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  gradeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  freshBadge: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  freshBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  cardBody: { padding: 14 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cropName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
  varietyText: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, fontWeight: '600' },
  priceValue: { fontSize: 18, fontWeight: '900', color: Colors.secondary, textAlign: 'right' },
  priceUnit: { fontSize: 10, color: Colors.textTertiary, textAlign: 'right', marginTop: -2 },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceSubtle, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, maxWidth: '48%' },
  metaText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },

  logisticsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  logChip: { flexDirection: 'row', gap: 3, alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  logChipText: { fontSize: 10, color: Colors.info, fontWeight: '700' },

  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  sellerPic: { width: 34, height: 34, borderRadius: 17 },
  sellerName: { fontSize: 13, color: Colors.textPrimary, fontWeight: '700' },
  sellerMeta: { fontSize: 10, color: Colors.textTertiary, marginTop: 1 },
  inquireBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill },
  inquireBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Empty state
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.pill, marginTop: 20 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Sheets
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  stepBadge: { fontSize: 12, color: Colors.primary, fontWeight: '800', backgroundColor: Colors.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  resetText: { color: Colors.error, fontWeight: '700', fontSize: 13 },

  filterLabel: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, marginTop: 16, paddingHorizontal: 20 },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 8 },
  gradePick: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  gradePickText: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600' },

  // Form
  formInput: { backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.textPrimary, marginTop: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 0.2 },
  fieldHint: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  errorText: { color: Colors.error, fontSize: 11, marginTop: 4, fontWeight: '600' },

  chipPick: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  chipPickActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipPickText: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600' },

  dropdown: { position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: '#fff', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, zIndex: 20, ...Shadow.card },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemText: { fontSize: 14, color: Colors.textPrimary },

  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  toggleBg: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#D1D5DB', padding: 3 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },

  stepperRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotText: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary },
  stepLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 4, fontWeight: '600' },

  primaryBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingVertical: 14, marginTop: 16, marginHorizontal: 20 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  secondaryBtn: { flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  footerRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },

  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  thumbWrap: { width: '31%', aspectRatio: 1, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbClose: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  coverTag: { position: 'absolute', bottom: 4, left: 4, backgroundColor: Colors.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  coverTagText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  addThumb: { width: '31%', aspectRatio: 1, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.primary + '60', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },

  // Review
  reviewCard: { backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.lg, padding: 16, marginTop: 8 },
  reviewImg: { width: '100%', height: 140, borderRadius: Radius.md, marginBottom: 10 },
  reviewCrop: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  reviewVariety: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  reviewItem: { width: '48%', backgroundColor: '#fff', padding: 10, borderRadius: Radius.md },
  reviewItemLabel: { fontSize: 10, color: Colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  reviewItemValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '700', marginTop: 2 },

  // Inquiry
  inqHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, backgroundColor: Colors.surfaceSubtle, borderRadius: Radius.md },
  inqImg: { width: 60, height: 60, borderRadius: Radius.md },
});
