import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: Boolean(process.env.VERCEL),
      HAS_DATABASE_URL: Boolean(process.env.DATABASE_URL),
      HAS_FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      HAS_FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      HAS_FIREBASE_PRIVATE_KEY: Boolean(process.env.FIREBASE_PRIVATE_KEY),
      HAS_GOOGLE_APP_CREDS: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)),
      SHEETS_PRIMARY: process.env.HURIZA_SHEETS_PRIMARY,
      HAS_SHEETS_SPREADSHEET_ID: Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID),
      HAS_DEMO_MASTER_KEY: Boolean(process.env.HURIZA_DEMO_MASTER_KEY),
    },
  };

  // Test Firebase Admin
  try {
    const { firebaseAdminAuth, hasAdminCredentials } = await import('@/server/firebase-admin');
    const auth = firebaseAdminAuth();
    diagnostics.firebaseAdmin = { ok: true, appName: auth.app.name, hasAdminCredentials: hasAdminCredentials() };
  } catch (err: unknown) {
    diagnostics.firebaseAdmin = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
  }

  // Test Database
  try {
    const { getDb, getDbDiagnostics } = await import('@/server/db');
    const db = await getDb();
    const res = await db.query('SELECT 1 as alive');
    diagnostics.database = { ok: true, alive: res.rows, ...getDbDiagnostics() };
  } catch (err: unknown) {
    diagnostics.database = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
