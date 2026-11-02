// One-time helper: authorizes this app with your Strava account and saves a
// refresh token into .env.local so the phone app can fetch your rides.
//
// Usage:  node scripts/get-strava-token.mjs
// Needs EXPO_PUBLIC_STRAVA_CLIENT_ID and EXPO_PUBLIC_STRAVA_CLIENT_SECRET in .env.local.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = 8723;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');

function readEnv() {
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function setEnvVar(key, value) {
  let text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, line) : text.replace(/\n?$/, '\n') + line + '\n';
  writeFileSync(envPath, text);
}

const env = readEnv();
const clientId = env.EXPO_PUBLIC_STRAVA_CLIENT_ID;
const clientSecret = env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error(`Missing client ID/secret. Copy .env.example to .env.local and fill them in first.`);
  process.exit(1);
}

const authUrl =
  'https://www.strava.com/oauth/authorize?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'force',
    scope: 'read,activity:read_all',
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get('code');
  const scope = url.searchParams.get('scope') ?? '';
  if (!code) {
    res.end('Authorization was denied or failed. You can close this tab.');
    console.error('No code returned:', url.searchParams.get('error'));
    server.close();
    return;
  }
  if (!scope.includes('activity:read')) {
    console.warn('Warning: activity read permission was not granted; the app will not see your rides.');
  }
  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    setEnvVar('EXPO_PUBLIC_STRAVA_REFRESH_TOKEN', data.refresh_token);
    const who = data.athlete ? `${data.athlete.firstname} ${data.athlete.lastname}` : 'your account';
    console.log(`Connected to Strava as ${who}. Refresh token saved to .env.local.`);
    res.end('Connected! You can close this tab and go back to the terminal.');
  } catch (e) {
    console.error('Token exchange failed:', e.message);
    res.end('Token exchange failed - see the terminal.');
  }
  server.close();
});

server.listen(PORT, () => {
  console.log('Open this URL in your browser and click Authorize:\n');
  console.log(authUrl + '\n');
});
