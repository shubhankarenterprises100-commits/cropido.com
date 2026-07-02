import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { Colors, Radius } from '@/src/theme';

const MAX_TRIES = 10;
const INTERVAL_MS = 1500;

export default function PaymentSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_token?: string; session_id?: string; status?: string }>();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<'polling' | 'paid' | 'pending' | 'failed' | 'cancelled'>('polling');
  const [details, setDetails] = useState<any>(null);
  const tries = useRef(0);

  const token = params.session_token;
  const initialStatus = params.status;

  useEffect(() => {
    if (initialStatus === 'cancelled') { setStatus('cancelled'); return; }
    if (!token && !params.session_id) { setStatus('failed'); return; }
    let cancelled = false;

    const poll = async () => {
      try {
        // Razorpay flow
        if (token) {
          const r = await api.rzpStatus(token);
          if (cancelled) return;
          setDetails(r.transaction);
          if (r.payment_status === 'paid') { setStatus('paid'); refresh(); return; }
          if (r.payment_status === 'failed_signature' || r.payment_status === 'failed') { setStatus('failed'); return; }
        } else if (params.session_id) {
          // Stripe fallback (legacy)
          const r = await api.paymentStatus(String(params.session_id));
          if (cancelled) return;
          setDetails(r.transaction);
          if (r.payment_status === 'paid') { setStatus('paid'); refresh(); return; }
          if (r.payment_status === 'failed' || r.payment_status === 'expired') { setStatus('failed'); return; }
        }
        tries.current += 1;
        if (tries.current >= MAX_TRIES) { setStatus('pending'); return; }
        setTimeout(poll, INTERVAL_MS);
      } catch {
        tries.current += 1;
        if (tries.current >= MAX_TRIES) { setStatus('failed'); return; }
        setTimeout(poll, INTERVAL_MS);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [token, params.session_id, initialStatus, refresh]);

  const planLabel = details?.plan_id?.replace('_', ' ').toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {status === 'polling' && (
          <>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.title}>Verifying payment…</Text>
            <Text style={styles.sub}>Hang tight, this may take a few seconds.</Text>
          </>
        )}
        {status === 'paid' && (
          <>
            <LinearGradient colors={[Colors.primary, Colors.primary700]} style={styles.successIcon}>
              <Ionicons name="checkmark" size={54} color="#fff" />
            </LinearGradient>
            <Text style={styles.title}>Payment Successful! 🎉</Text>
            <Text style={styles.sub}>
              {details?.kind === 'subscription' ? (
                <>You&apos;re now on the <Text style={{ fontWeight: '700', color: Colors.primary }}>{planLabel}</Text> plan.</>
              ) : (
                <>Your order payment is confirmed.</>
              )}
            </Text>
            <View style={styles.receipt}>
              <View style={styles.rRow}><Text style={styles.rLabel}>Amount</Text><Text style={styles.rValue}>₹{details?.amount_inr ?? details?.amount}</Text></View>
              <View style={styles.rRow}><Text style={styles.rLabel}>Method</Text><Text style={styles.rValue}>{details?.razorpay_payment_id ? 'Razorpay UPI/Card' : 'Stripe'}</Text></View>
              <View style={styles.rRow}><Text style={styles.rLabel}>Reference</Text><Text style={styles.rValue}>{(details?.razorpay_payment_id || details?.session_id || '').slice(-10)}</Text></View>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/home')} testID="payment-success-home">
              <Text style={styles.primaryText}>Back to Home</Text>
            </TouchableOpacity>
          </>
        )}
        {status === 'cancelled' && (
          <>
            <Ionicons name="close-circle" size={72} color={Colors.warning} />
            <Text style={styles.title}>Payment cancelled</Text>
            <Text style={styles.sub}>You cancelled the payment. No amount was charged.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/subscription')}>
              <Text style={styles.primaryText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}
        {status === 'pending' && (
          <>
            <Ionicons name="time" size={72} color={Colors.warning} />
            <Text style={styles.title}>Still processing…</Text>
            <Text style={styles.sub}>Your payment is being confirmed. Check payment history in a moment.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/payments')}>
              <Text style={styles.primaryText}>View Payments</Text>
            </TouchableOpacity>
          </>
        )}
        {status === 'failed' && (
          <>
            <Ionicons name="close-circle" size={72} color={Colors.error} />
            <Text style={styles.title}>Payment failed</Text>
            <Text style={styles.sub}>Something went wrong. Please try again.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/subscription')}>
              <Text style={styles.primaryText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginTop: 16, letterSpacing: -0.5, textAlign: 'center' },
  sub: { fontSize: 15, color: Colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 22 },
  receipt: { marginTop: 24, backgroundColor: Colors.surfaceSubtle, padding: 16, borderRadius: Radius.lg, width: '100%' },
  rRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rLabel: { color: Colors.textSecondary, fontSize: 13 },
  rValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  primaryBtn: { marginTop: 24, backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingHorizontal: 30, paddingVertical: 14 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
