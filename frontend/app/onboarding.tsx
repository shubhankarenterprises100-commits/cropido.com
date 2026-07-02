import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, supportedLanguages } from '@/src/contexts/AppContext';
import { Colors, Radius, Spacing } from '@/src/theme';

const { width, height } = Dimensions.get('window');

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setOnboarded, language, setLanguage } = useApp();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const slides = [
    { key: 'welcome', title: t('onboarding.welcome'), sub: t('onboarding.welcomeSub'),
      image: 'https://images.pexels.com/photos/15469881/pexels-photo-15469881.jpeg', icon: 'leaf' as const },
    { key: 'marketplace', title: t('onboarding.marketplace'), sub: t('onboarding.marketplaceSub'),
      image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200', icon: 'basket' as const },
    { key: 'ai', title: t('onboarding.ai'), sub: t('onboarding.aiSub'),
      image: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=1200', icon: 'sparkles' as const },
    { key: 'sell', title: t('onboarding.sell'), sub: t('onboarding.sellSub'),
      image: 'https://images.pexels.com/photos/17286188/pexels-photo-17286188.jpeg?w=1200', icon: 'cash' as const },
    { key: 'rent', title: t('onboarding.rent'), sub: t('onboarding.rentSub'),
      image: 'https://images.pexels.com/photos/7457180/pexels-photo-7457180.jpeg?w=1200', icon: 'construct' as const },
    { key: 'connect', title: t('onboarding.connect'), sub: t('onboarding.connectSub'),
      image: 'https://images.pexels.com/photos/6472502/pexels-photo-6472502.jpeg?w=1200', icon: 'people' as const },
    { key: 'language', title: t('onboarding.language'), sub: t('onboarding.languageSub'),
      image: 'https://images.pexels.com/photos/15523676/pexels-photo-15523676.jpeg', icon: 'globe' as const, isLang: true },
  ];

  const goNext = async () => {
    if (index < slides.length - 1) {
      const n = index + 1;
      setIndex(n);
      scrollRef.current?.scrollTo({ x: n * width, animated: true });
    } else {
      await setOnboarded();
      router.replace('/(auth)/login');
    }
  };

  const skip = async () => {
    await setOnboarded();
    router.replace('/(auth)/login');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        testID="onboarding-scroll"
      >
        {slides.map((s, i) => (
          <View key={s.key} style={{ width, height }}>
            <Image source={{ uri: s.image }} style={styles.bgImage} />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']}
              style={StyleSheet.absoluteFillObject}
            />
            <SafeAreaView style={styles.slide} edges={['top', 'bottom']}>
              <View style={styles.header}>
                <View style={styles.brand}>
                  <View style={styles.brandIcon}>
                    <Ionicons name="leaf" size={18} color={Colors.primary} />
                  </View>
                  <Text style={styles.brandText}>Cropido</Text>
                </View>
                {i < slides.length - 1 && (
                  <TouchableOpacity onPress={skip} testID="onboarding-skip">
                    <Text style={styles.skip}>{t('common.skip')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.content}>
                <View style={styles.iconChip}>
                  <Ionicons name={s.icon} size={22} color={Colors.secondary} />
                </View>
                <Text style={styles.title}>{s.title}</Text>
                <Text style={styles.sub}>{s.sub}</Text>

                {s.isLang && (
                  <View style={styles.langWrap}>
                    {supportedLanguages.map((l) => (
                      <TouchableOpacity
                        key={l.code}
                        style={[styles.langPill, language === l.code && styles.langPillActive]}
                        onPress={() => setLanguage(l.code)}
                        testID={`onboarding-lang-${l.code}`}
                      >
                        <Text style={[styles.langNative, language === l.code && styles.langActiveText]}>{l.native}</Text>
                        <Text style={[styles.langLabel, language === l.code && styles.langActiveText]}>{l.label}</Text>
                        {language === l.code && (
                          <Ionicons name="checkmark-circle" size={20} color={Colors.primary} style={{ position: 'absolute', right: 12, top: 12 }} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </SafeAreaView>
          </View>
        ))}
      </ScrollView>

      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={goNext} testID="onboarding-next">
          <Text style={styles.nextText}>{index === slides.length - 1 ? t('common.getStarted') : t('common.next')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bgImage: { ...StyleSheet.absoluteFillObject, width, height, resizeMode: 'cover' },
  slide: { flex: 1, justifyContent: 'space-between', padding: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  skip: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '500', paddingHorizontal: 12, paddingVertical: 6 },
  content: { paddingBottom: 140 },
  iconChip: {
    alignSelf: 'flex-start', width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,152,0,0.18)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,152,0,0.4)',
    marginBottom: Spacing.lg,
  },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 40 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginTop: 10, lineHeight: 24 },
  langWrap: { marginTop: 24, gap: 12 },
  langPill: {
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 18,
  },
  langPillActive: { backgroundColor: '#fff', borderColor: Colors.primary },
  langNative: { color: '#fff', fontSize: 18, fontWeight: '700' },
  langLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  langActiveText: { color: Colors.textPrimary },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 24, backgroundColor: Colors.secondary },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary,
    paddingHorizontal: 22, paddingVertical: 14, borderRadius: Radius.pill,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  nextText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
