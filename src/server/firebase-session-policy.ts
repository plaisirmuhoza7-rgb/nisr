import type {Auth, DecodedIdToken} from 'firebase-admin/auth';

// Never retry without revocation checking: that would accept disabled or revoked users.
export function verifyAuthToken(auth: Pick<Auth, 'verifyIdToken'>, token: string): Promise<DecodedIdToken> {
 return auth.verifyIdToken(token, true);
}

export function createSessionCookie(auth: Pick<Auth, 'createSessionCookie'>, token: string, maxAgeSeconds: number): Promise<string> {
 return auth.createSessionCookie(token, {expiresIn:maxAgeSeconds*1000});
}

export async function verifiedSessionClaims(auth: Pick<Auth, 'verifySessionCookie'>, cookie: string, userId: unknown): Promise<DecodedIdToken | null> {
 if(typeof userId !== 'string') return null;
 try {
  const claims=await auth.verifySessionCookie(cookie,true);
  return claims.uid===userId && claims.email_verified===true ? claims : null;
 } catch { return null; }
}

export async function resolveStoredFirebaseSession(
 cookie: string,
 findUserId: () => Promise<unknown>,
 getAuth: () => Pick<Auth, 'verifySessionCookie'>,
): Promise<DecodedIdToken | null> {
 const userId=await findUserId();
 // A deleted or expired database session is authoritative, including after logout.
 if(typeof userId!=='string') return null;
 return verifiedSessionClaims(getAuth(),cookie,userId);
}
