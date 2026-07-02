import { useEffect, useState, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import * as Location from 'expo-location';

export type LocationState = {
  status: 'idle' | 'loading' | 'granted' | 'denied' | 'blocked' | 'error';
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  canAskAgain: boolean;
};

const initial: LocationState = {
  status: 'idle', city: null, region: null,
  latitude: null, longitude: null, error: null, canAskAgain: true,
};

async function getWebLocation(): Promise<{ lat: number; lon: number } | null> {
  if (typeof window === 'undefined' || !navigator?.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 0, enableHighAccuracy: false },
    );
  });
}

async function reverseGeocodeWeb(lat: number, lon: number) {
  // OpenStreetMap Nominatim — free, no API key. Use only for display.
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`, {
      headers: { 'Accept-Language': 'en' },
    });
    const j = await r.json();
    return {
      city: j.address?.city || j.address?.town || j.address?.village || j.address?.county || j.name,
      region: j.address?.state,
    };
  } catch { return { city: null, region: null }; }
}

export function useDeviceLocation() {
  const [state, setState] = useState<LocationState>(initial);

  const request = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading', error: null }));

    if (Platform.OS === 'web') {
      const pos = await getWebLocation();
      if (!pos) {
        setState({ ...initial, status: 'denied', canAskAgain: false, error: 'Web location denied or unavailable' });
        return;
      }
      const geo = await reverseGeocodeWeb(pos.lat, pos.lon);
      setState({
        status: 'granted', latitude: pos.lat, longitude: pos.lon,
        city: geo.city, region: geo.region, error: null, canAskAgain: true,
      });
      return;
    }

    // Native (iOS/Android)
    const existing = await Location.getForegroundPermissionsAsync();
    let perm = existing;
    if (existing.status !== 'granted') {
      if (existing.status === 'denied' && !existing.canAskAgain) {
        setState({ ...initial, status: 'blocked', canAskAgain: false, error: 'Location permission blocked. Enable it in Settings.' });
        return;
      }
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (perm.status !== 'granted') {
      setState({
        ...initial,
        status: perm.canAskAgain ? 'denied' : 'blocked',
        canAskAgain: perm.canAskAgain,
        error: 'Location permission not granted',
      });
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geocode = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const first = geocode?.[0];
      setState({
        status: 'granted',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        city: first?.city || first?.subregion || first?.district || null,
        region: first?.region || null,
        error: null,
        canAskAgain: true,
      });
    } catch (e: any) {
      setState({ ...initial, status: 'error', error: e?.message || 'Unable to fetch location' });
    }
  }, []);

  const openSettings = useCallback(() => {
    if (Platform.OS === 'web') return;
    Linking.openSettings();
  }, []);

  useEffect(() => {
    request();
  }, [request]);

  return { ...state, request, openSettings };
}
