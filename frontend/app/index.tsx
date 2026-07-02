import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/contexts/AuthContext';
import { useApp } from '@/src/contexts/AppContext';
import { Colors } from '@/src/theme';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { hasOnboarded } = useApp();

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!hasOnboarded) router.replace('/onboarding');
      else if (!user) router.replace('/(auth)/login');
      else router.replace('/(tabs)/home');
    }, 900);
    return () => clearTimeout(t);
  }, [loading, hasOnboarded, user, router]);

  return (
    <LinearGradient colors={[Colors.primary, Colors.primary700]} style={styles.container}>
      <View style={styles.logoWrap} testID="splash-logo">
        <View style={styles.iconBubble}>
          <Ionicons name="leaf" size={64} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Cropido</Text>
        <Text style={styles.subtitle}>Digital Agriculture Ecosystem</Text>
      </View>
      <ActivityIndicator color="#fff" size="small" style={{ marginTop: 40 }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { alignItems: 'center' },
  iconBubble: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20,
  },
  title: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 8, letterSpacing: 0.3 },
});
