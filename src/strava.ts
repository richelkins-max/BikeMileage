import AsyncStorage from '@react-native-async-storage/async-storage';

// Note: EXPO_PUBLIC_ values are bundled into the app in plain text. That's fine
// for a personal, single-user app you never publish — don't ship it to a store.
const CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET;
const INITIAL_REFRESH_TOKEN = process.env.EXPO_PUBLIC_STRAVA_REFRESH_TOKEN;

const TOKEN_KEY = 'strava.token.v1';
const RIDES_KEY = 'strava.rides.v1';

const RIDE_SPORT_TYPES = new Set([
  'Ride',
  'MountainBikeRide',
  'GravelRide',
  'EBikeRide',
  'EMountainBikeRide',
  'VirtualRide',
  'Velomobile',
  'Handcycle',
]);

export const METERS_PER_MILE = 1609.344;

export type Ride = {
  id: number;
  name: string;
  sportType: string;
  distanceMeters: number;
  movingTimeSec: number;
  elevationGainMeters: number;
  startDate: string; // ISO, UTC
  startDateLocal: string; // ISO, rider's local time (no real offset)
};

type StoredToken = { accessToken: string; refreshToken: string; expiresAt: number };

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && INITIAL_REFRESH_TOKEN);
}

async function getAccessToken(): Promise<string> {
  const raw = await AsyncStorage.getItem(TOKEN_KEY);
  const stored: StoredToken | null = raw ? JSON.parse(raw) : null;
  // Reuse the current token if it has more than a minute left.
  if (stored && stored.expiresAt - 60 > Date.now() / 1000) return stored.accessToken;

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      // Strava may rotate the refresh token, so prefer the latest one we saved.
      refresh_token: stored?.refreshToken ?? INITIAL_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava sign-in failed (${res.status}). Re-run "npm run strava-auth".`);
  }
  const data = await res.json();
  const token: StoredToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token.accessToken;
}

async function fetchRidesAfter(afterEpochSec: number): Promise<Ride[]> {
  const token = await getAccessToken();
  const rides: Ride[] = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({
      after: String(afterEpochSec),
      per_page: '200',
      page: String(page),
    });
    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 429) throw new Error('Strava rate limit hit — try again in 15 minutes.');
    if (!res.ok) throw new Error(`Strava request failed (${res.status}).`);
    const batch: any[] = await res.json();
    for (const a of batch) {
      if (!RIDE_SPORT_TYPES.has(a.sport_type)) continue;
      rides.push({
        id: a.id,
        name: a.name,
        sportType: a.sport_type,
        distanceMeters: a.distance,
        movingTimeSec: a.moving_time,
        elevationGainMeters: a.total_elevation_gain,
        startDate: a.start_date,
        startDateLocal: a.start_date_local,
      });
    }
    if (batch.length < 200) break;
  }
  return rides;
}

export async function loadCachedRides(): Promise<Ride[]> {
  const raw = await AsyncStorage.getItem(RIDES_KEY);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Fetches rides newer than the newest cached one (or everything if `full`),
 * merges them into the cache, and returns all rides, newest first.
 */
export async function syncRides(full = false): Promise<Ride[]> {
  const cached = full ? [] : await loadCachedRides();
  const newest = cached.reduce((max, r) => Math.max(max, Date.parse(r.startDate) / 1000), 0);
  const fresh = await fetchRidesAfter(newest);

  const byId = new Map<number, Ride>();
  for (const r of cached) byId.set(r.id, r);
  for (const r of fresh) byId.set(r.id, r);
  const all = [...byId.values()].sort((a, b) => b.startDate.localeCompare(a.startDate));

  await AsyncStorage.setItem(RIDES_KEY, JSON.stringify(all));
  return all;
}
