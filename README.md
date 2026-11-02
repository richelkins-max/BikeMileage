# Bike Miles

Personal Expo app that shows your cycling mileage from Strava (fed by Garmin Connect auto-sync).

## One-time setup

1. **Link Garmin → Strava:** Garmin Connect app → More → Settings → Connected Apps → Strava.
2. **Create a Strava API app:** https://www.strava.com/settings/api
   - Authorization Callback Domain: `localhost`
3. `cp .env.example .env.local` and paste in your Client ID and Client Secret.
4. `npm run strava-auth` → open the printed URL, click Authorize. This saves your refresh token to `.env.local`.

## Run

```bash
npx expo start
```
Scan the QR code with the **Expo Go** app on your phone (same Wi-Fi as your computer).

Pull down to refresh. The first load downloads your full history; after that, only new rides.

## Notes
- Your Strava keys are bundled into the app, which is fine for a personal app but don't publish it to an app store as-is.
- Counted ride types: Ride, MountainBikeRide, GravelRide, EBikeRide, EMountainBikeRide, VirtualRide, Velomobile, Handcycle (see `src/strava.ts`).
