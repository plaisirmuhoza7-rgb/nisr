import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { Database } from './db';
import { DomainError } from './permissions';
import { readAccount } from './accounts';
import type { AccountUser } from '@/lib/access';

export const PHONE_COOKIE = 'huriza_phone_session';
const MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

export function normalizeRwandanPhone(raw: string): string {
  let digits = raw.trim().replace(/[\s\-\(\)\.]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00250')) digits = digits.slice(5);
  else if (digits.startsWith('250')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 9 && digits.startsWith('7')) {
    digits = '0' + digits;
  }
  if (!/^07[2389]\d{7}$/.test(digits)) {
    throw new DomainError('Invalid Rwandan telephone number. Use a valid MTN or Airtel number (e.g. 0788123456).', 400);
  }
  return digits;
}

export function hashPhonePin(pin: string): string {
  const cleaned = pin.trim().replace(/[\s\-]/g, '');
  if (!/^\d{4,8}$/.test(cleaned)) {
    throw new DomainError('PIN must be between 4 and 8 digits.', 400);
  }
  return createHash('sha256').update(`HURIZA_PIN_SALT_${cleaned}`).digest('hex');
}

export function phoneToEmail(phone: string): string {
  const normalized = normalizeRwandanPhone(phone);
  return `${normalized}@momo.rw`;
}

export async function loginWithPhone(db: Database, rawPhone: string, pin: string): Promise<AccountUser> {
  const phone = normalizeRwandanPhone(rawPhone);
  const pinHash = hashPhonePin(pin);
  const email = phoneToEmail(phone);

  const { rows } = await db.query<{ id: string; password_hash: string; role: string }>(
    'SELECT id, password_hash, role FROM app_users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user || user.password_hash !== pinHash) {
    throw new DomainError('Invalid telephone number or PIN. Please check and try again.', 401);
  }

  const profileRow = (
    await db.query<{ tenant_id: string; status: string }>(
      'SELECT tenant_id, status FROM account_profiles WHERE user_id = $1',
      [user.id]
    )
  ).rows[0];

  if (!profileRow) {
    throw new DomainError('Account profile not found. Contact your group administrator.', 404);
  }
  if (profileRow.status === 'disabled') {
    throw new DomainError('This account is disabled. Contact your group administrator.', 403);
  }

  const sessionToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

  await db.query(
    "INSERT INTO sessions(token_hash, tenant_id, user_id, expires_at) VALUES($1, $2, $3, now() + interval '8 hours')",
    [tokenHash, profileRow.tenant_id, user.id]
  );

  try {
    const jar = await cookies();
    const oldFirebaseSession = jar.get('huriza_firebase_session')?.value;
    if (oldFirebaseSession) {
      const oldHash = createHash('sha256').update(oldFirebaseSession).digest('hex');
      await db.query('DELETE FROM firebase_sessions WHERE token_hash = $1', [oldHash]).catch(() => undefined);
    }
    jar.delete('huriza_firebase_session');
    jar.delete('huriza_session');
    jar.set(PHONE_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'),
      maxAge: MAX_AGE,
      path: '/'
    });
  } catch {
    // Allows running in isolated Node test environments outside Next request store
  }

  const account = await readAccount(db, user.id, true);
  if (!account) {
    throw new DomainError('Could not load account details.', 500);
  }
  return account;
}
