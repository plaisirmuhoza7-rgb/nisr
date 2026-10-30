import {GoogleAuth} from 'google-auth-library';
import {existsSync} from 'node:fs';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function parseInlineServiceAccount(raw: string | undefined): {client_email: string; private_key: string} | null {
  if (!raw) return null;
  try {
    const trimmed = raw.trim();
    const jsonStr = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
    if (!jsonStr.startsWith('{')) return null;
    const parsed = JSON.parse(jsonStr) as {client_email?: string; private_key?: string};
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, '\n'),
      };
    }
  } catch {
    // Ignore parse errors and fall through to file/ADC resolution
  }
  return null;
}

export function createSheetsGoogleAuth(scopes: string[] = [SHEETS_SCOPE]): GoogleAuth {
  const inlineCandidates = [
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ];

  for (const candidate of inlineCandidates) {
    const credentials = parseInlineServiceAccount(candidate);
    if (credentials) {
      return new GoogleAuth({scopes, credentials});
    }
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const hasValidGacFile = Boolean(gacPath && !gacPath.startsWith('{') && existsSync(gacPath));

  if (!hasValidGacFile && clientEmail && privateKey) {
    return new GoogleAuth({
      scopes,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
    });
  }

  return new GoogleAuth({scopes});
}
