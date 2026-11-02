import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { isConfigured, loadCachedRides, METERS_PER_MILE, Ride, syncRides } from './src/strava';

const ORANGE = '#FC4C02';

// Strava's start_date_local is the rider's wall-clock time with a fake "Z" suffix,
// so read the date parts straight from the string instead of converting time zones.
function localParts(ride: Ride) {
  const [y, m, d] = ride.startDateLocal.slice(0, 10).split('-').map(Number);
  return { y, m, d, date: new Date(y, m - 1, d) };
}

function miles(meters: number) {
  return meters / METERS_PER_MILE;
}

function fmtMiles(meters: number) {
  return miles(meters).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function computeTotals(rides: Ride[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Monday

  const t = { week: 0, month: 0, year: 0, all: 0, yearRides: 0 };
  for (const r of rides) {
    const { y, m, date } = localParts(r);
    t.all += r.distanceMeters;
    if (y === now.getFullYear()) {
      t.year += r.distanceMeters;
      t.yearRides++;
      if (m === now.getMonth() + 1) t.month += r.distanceMeters;
    }
    if (date >= weekStart) t.week += r.distanceMeters;
  }
  return t;
}

function StatTile({ label, meters }: { label: string; meters: number }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{fmtMiles(meters)}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function RideRow({ ride }: { ride: Ride }) {
  const { date } = localParts(ride);
  const mins = Math.round(ride.movingTimeSec / 60);
  const hours = ride.movingTimeSec / 3600;
  const mph = hours > 0 ? miles(ride.distanceMeters) / hours : 0;
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {ride.name}
        </Text>
        <Text style={styles.rowMeta}>
          {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          {' · '}
          {Math.floor(mins / 60)}h {mins % 60}m · {mph.toFixed(1)} mph
        </Text>
      </View>
      <Text style={styles.rowMiles}>{fmtMiles(ride.distanceMeters)} mi</Text>
    </View>
  );
}

function Home() {
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (full = false) => {
    setRefreshing(true);
    setError(null);
    try {
      setRides(await syncRides(full));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Show cached rides instantly, then pull anything new from Strava.
    loadCachedRides().then((cached) => {
      if (cached.length) setRides(cached);
      refresh();
    });
  }, [refresh]);

  const totals = useMemo(() => computeTotals(rides ?? []), [rides]);

  if (rides === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ORANGE} size="large" />
        <Text style={styles.muted}>Loading your rides from Strava…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rides ?? []}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => <RideRow ride={item} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={ORANGE} />
      }
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Bike Miles</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.hero}>
            <Text style={styles.heroValue}>{fmtMiles(totals.year)}</Text>
            <Text style={styles.heroLabel}>
              miles in {new Date().getFullYear()} · {totals.yearRides} rides
            </Text>
          </View>
          <View style={styles.tiles}>
            <StatTile label="This week" meters={totals.week} />
            <StatTile label="This month" meters={totals.month} />
            <StatTile label="All time" meters={totals.all} />
          </View>
          <Text style={styles.section}>Recent rides</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.muted}>No rides found yet.</Text>}
      ListFooterComponent={
        <Pressable onPress={() => refresh(true)} disabled={refreshing} style={styles.resync}>
          <Text style={styles.resyncText}>Re-download all rides</Text>
          <Text style={styles.muted}>Use this if you edited or deleted rides on Strava.</Text>
        </Pressable>
      }
      contentContainerStyle={styles.list}
    />
  );
}

function NotConfigured() {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Connect Strava</Text>
      <Text style={styles.muted}>
        Copy .env.example to .env.local, add your Strava client ID and secret, run{' '}
        <Text style={{ fontWeight: '600' }}>npm run strava-auth</Text>, then restart the app.
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {isConfigured() ? <Home /> : <NotConfigured />}
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F4' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  list: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
  hero: { backgroundColor: ORANGE, borderRadius: 16, padding: 20, marginBottom: 12 },
  heroValue: { fontSize: 48, fontWeight: '800', color: '#fff' },
  heroLabel: { fontSize: 15, color: '#FFE3D6', marginTop: 2 },
  tiles: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  tileValue: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  tileLabel: { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  section: { fontSize: 13, fontWeight: '600', color: '#6B6B6B', textTransform: 'uppercase', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  rowName: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  rowMeta: { fontSize: 13, color: '#6B6B6B', marginTop: 2 },
  rowMiles: { fontSize: 18, fontWeight: '700', color: ORANGE },
  muted: { fontSize: 14, color: '#6B6B6B', textAlign: 'center' },
  error: { backgroundColor: '#FDECEA', color: '#B3261E', padding: 12, borderRadius: 8, marginBottom: 12 },
  resync: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  resyncText: { fontSize: 15, fontWeight: '600', color: ORANGE },
});
