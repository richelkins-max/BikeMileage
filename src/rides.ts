// Shared ride model used by every data source (Apple Health, Strava).
export const METERS_PER_MILE = 1609.344;

export type Ride = {
  id: string;
  name: string;
  sportType: string;
  distanceMeters: number;
  movingTimeSec: number;
  elevationGainMeters: number;
  startDate: string; // ISO, UTC
  startDateLocal: string; // "YYYY-MM-DDTHH:mm:ss" in the rider's local time
};

/** Formats a Date as local wall-clock time, matching Strava's start_date_local. */
export function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}
