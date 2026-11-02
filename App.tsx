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
import { isHealthSupported, loadHealthRides } from './src/health';
import { METERS_PER_MILE, Ride } from './src/rides';

const ORANGE = '#FC4C02';

// startDateLocal is the rider's wall-clock time, so read the date parts
// straight from the string instead of converting time zones.
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

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setRides(await loadHealthRides());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totals = useMemo(() => computeTotals(rides ?? []), [rides]);

  if (rides === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ORANGE} size="large" />
        <Text style={styles.muted}>Reading your rides from Apple Health…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rides ?? []}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => <RideRow ride={item} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={ORANGE} />
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
      ListEmptyComponent={<NoRidesHelp onRetry={refresh} busy={refreshing} />}
      contentContainerStyle={styles.list}
    />
  );
}

// iOS never tells an app that Health access was denied — it just returns no
// data — so an empty list has to explain every likely cause.
function NoRidesHelp({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
  return (
    <View style={styles.help}>
      <Text style={styles.helpTitle}>No rides found in Apple Health</Text>
      <Text style={styles.helpItem}>
        • Allow access: Settings → Health → Data Access & Devices → Bike Miles → turn on Workouts.
      </Text>
      <Text style={styles.helpItem}>
        • Using Garmin? In Garmin Connect: More → Settings → Connected Apps → Apple Health, and
        turn on Workouts.
      </Text>
      <Text style={styles.helpItem}>• Rides must be recorded as a Cycling workout.</Text>
      <Pressable onPress={onRetry} disabled={busy} style={styles.retry}>
        <Text style={styles.retryText}>Check again</Text>
      </Pressable>
    </View>
  );
}

function Unsupported() {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>iPhone only</Text>
      <Text style={styles.muted}>
        Bike Miles reads your rides from Apple Health, which is only available on iPhone.
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {isHealthSupported() ? <Home /> : <Unsupported />}
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
  help: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 },
  helpTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  helpItem: { fontSize: 14, color: '#4A4A4A', lineHeight: 20 },
  retry: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 8 },
  retryText: { fontSize: 15, fontWeight: '600', color: ORANGE },
});
