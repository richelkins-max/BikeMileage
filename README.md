# Bike Miles

iPhone app that totals your cycling miles from **Apple Health**. Rides recorded on a
Garmin show up automatically once Garmin Connect syncs to Apple Health.

## Getting your rides into Apple Health

- **Garmin:** Garmin Connect app → More → Settings → Connected Apps → Apple Health → turn on Workouts.
- **Apple Watch / Wahoo / most others:** already write cycling workouts to Apple Health.

## Running it on your iPhone

Apple Health needs native code, so this app **does not run in Expo Go**. You need a
*development build*: your own copy of the app, built once in the cloud with EAS.

1. Join the Apple Developer Program ($99/yr) — required to install HealthKit apps on a device.
2. One-time build (no Mac needed):
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build --profile development --platform ios
   ```
   EAS walks you through registering your iPhone and signing. Install the build from the link it gives you.
3. Day-to-day development:
   ```bash
   npx expo start
   ```
   Open the Bike Miles app on your phone. It loads your latest code, and saving a file updates it instantly.

You only need to rebuild (step 2) after adding a library with native code or changing `app.json`.

## Notes
- Bundle ID is `com.richelkins.bikemiles` (in `app.json`). Change it before your first build if you want something else — it's permanent once on the App Store.
- iOS never tells an app that Health access was denied; it just returns nothing. The app shows setup tips when it finds no rides.
- `src/strava.ts` and `scripts/get-strava-token.mjs` are the earlier Strava integration, unused for now, kept for a possible "Connect Strava" option.
