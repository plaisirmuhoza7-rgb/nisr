import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { loginWithPhone } from '@/server/phone-auth';
import { checkMutation, apiError } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    checkMutation(request);
    const body = await request.json();
    const input = z.object({
      phone: z.string().min(8).max(25),
      pin: z.string().min(4).max(12)
    }).parse(body);

    const db = await getDb();
    const user = await loginWithPhone(db, input.phone, input.pin);

    return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
