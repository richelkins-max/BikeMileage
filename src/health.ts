import {
  isHealthDataAvailable,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
  type Quantity,
  type WorkoutProxyTyped,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';
import { METERS_PER_MILE, Ride, toLocalIso } from './rides';

const METERS_PER_UNIT: Record<string, number> = {
  m: 1,
  km: 1000,
  cm: 0.01,
  mi: METERS_PER_MILE,
  yd: 0.9144,
  ft: 0.3048,
};

function toMeters(q?: Quantity): number | undefined {
  if (!q) return undefined;
  const factor = METERS_PER_UNIT[q.unit];
  return factor === undefined ? undefined : q.quantity * factor;
}

function toSeconds(q: Quantity): number {
  switch (q.unit) {
    case 'ms':
      return q.quantity / 1000;
    case 'min':
      return q.quantity * 60;
    case 'hr':
      return q.quantity * 3600;
    default:
      return q.quantity; // 's'
  }
}

export function isHealthSupported(): boolean {
  return Platform.OS === 'ios' && isHealthDataAvailable();
}

/**
 * Shows Apple's permission sheet the first time. iOS never reveals whether
 * read access was denied — a denied app just sees no workouts.
 */
export async function requestHealthAccess(): Promise<void> {
  await requestAuthorization({
    toRead: [WorkoutTypeIdentifier, 'HKQuantityTypeIdentifierDistanceCycling'],
  });
}

async function distanceFor(w: WorkoutProxyTyped): Promise<number> {
  const direct = toMeters(w.totalDistance);
  if (direct !== undefined) return direct;
  // Newer iOS versions may leave totalDistance empty and keep the value
  // in the workout's statistics instead.
  const stat = await w.getStatistic('HKQuantityTypeIdentifierDistanceCycling', 'm');
  return toMeters(stat?.sumQuantity) ?? 0;
}

function nameFor(w: WorkoutProxyTyped): string {
  const indoor = w.metadata?.HKIndoorWorkout === true;
  const source = w.sourceRevision?.source?.name;
  const label = indoor ? 'Indoor Ride' : 'Ride';
  return source ? `${label} · ${source}` : label;
}

/** Reads every cycling workout from Apple Health, newest first. */
export async function loadHealthRides(): Promise<Ride[]> {
  await requestHealthAccess();
  const workouts = await queryWorkoutSamples({
    limit: 0, // no limit
    ascending: false,
    filter: {
      OR: [
        { workoutActivityType: WorkoutActivityType.cycling },
        { workoutActivityType: WorkoutActivityType.handCycling },
      ],
    },
  });

  const rides = await Promise.all(
    workouts.map(async (w): Promise<Ride> => {
      const start = new Date(w.startDate);
      const elevation = toMeters(w.metadata?.HKElevationAscended);
      return {
        id: w.uuid,
        name: nameFor(w),
        sportType: w.metadata?.HKIndoorWorkout === true ? 'IndoorRide' : 'Ride',
        distanceMeters: await distanceFor(w),
        movingTimeSec: toSeconds(w.duration),
        elevationGainMeters: elevation ?? 0,
        startDate: start.toISOString(),
        startDateLocal: toLocalIso(start),
      };
    }),
  );
  workouts.forEach((w) => w.dispose());
  return rides;
}
