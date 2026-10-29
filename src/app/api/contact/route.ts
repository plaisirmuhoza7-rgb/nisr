import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';

export const runtime = 'nodejs';

// Simple in-memory rate limiting: 5 messages per 10 minutes per IP
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    if (rateMap.size > 2000) rateMap.clear();
    rateMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 6) {
    return false;
  }
  entry.count += 1;
  return true;
}

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
  email: z.string().trim().email('Invalid email address format.').max(120),
  phone: z.string().trim().max(30).optional().default(''),
  subject: z.string().trim().min(2, 'Subject must be at least 2 characters.').max(150),
  message: z.string().trim().min(5, 'Message must be at least 5 characters.').max(5000),
  organization: z.string().trim().max(100).optional().default(''),
  hp: z.string().max(200).optional().default(''),
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = forwarded || 'local';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many messages sent. Please wait a few minutes before submitting again.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message || 'Invalid form input.';
      return NextResponse.json({ error: issue }, { status: 400 });
    }

    const { name, email, phone, subject, message, organization, hp } = parsed.data;

    // Honeypot check for bots
    if (hp && hp.length > 0) {
      return NextResponse.json({ ok: true, message: 'Message received.' });
    }

    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    const toEmail = (process.env.CONTACT_TO_EMAIL || 'plaisirmuhoza7@gmail.com').trim();
    const fromEmail = (process.env.CONTACT_FROM_EMAIL || 'onboarding@resend.dev').trim();

    if (!apiKey) {
      console.warn('RESEND_API_KEY is not configured; simulated message logging.');
      return NextResponse.json({
        ok: true,
        message: 'Your inquiry has been received (simulation mode).',
      });
    }

    const resend = new Resend(apiKey);

    const dateStr = new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Kigali',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const cleanName = escapeHtml(name);
    const cleanEmail = escapeHtml(email);
    const cleanPhone = escapeHtml(phone || 'Not specified');
    const cleanOrg = escapeHtml(organization || 'Individual / None');
    const cleanSubject = escapeHtml(subject);
    const cleanMessage = escapeHtml(message).replace(/\n/g, '<br />');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>New HURIZA Contact Submission</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fb; margin: 0; padding: 24px; color: #162437; }
    .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #dce5ef; overflow: hidden; box-shadow: 0 10px 25px rgba(20,40,63,0.06); }
    .header { background: linear-gradient(135deg, #10243f 0%, #1c4774 100%); padding: 32px 30px; color: #ffffff; }
    .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 0; font-size: 13px; color: #b5cde8; }
    .body { padding: 30px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #e7edf4; }
    .meta-item { display: flex; flex-direction: column; gap: 4px; }
    .meta-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .meta-value { font-size: 14px; font-weight: 600; color: #1e293b; }
    .meta-value a { color: #2463a6; text-decoration: none; }
    .message-block { background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 24px; }
    .message-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px; }
    .message-content { font-size: 14px; line-height: 1.7; color: #334155; }
    .footer { padding: 20px 30px; background: #f8fafc; border-top: 1px solid #e7edf4; font-size: 12px; color: #64748b; text-align: center; }
    .reply-btn { display: inline-block; background: #2463a6; color: #ffffff !important; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>New Message from HURIZA Contact Page</h1>
      <p>Submitted via web contact form &bull; ${dateStr} (CAT Kigali)</p>
    </div>
    <div class="body">
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Sender Name</span>
          <span class="meta-value">${cleanName}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Email Address</span>
          <span class="meta-value"><a href="mailto:${cleanEmail}">${cleanEmail}</a></span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Phone Contact</span>
          <span class="meta-value">${phone ? `<a href="tel:${cleanPhone}">${cleanPhone}</a>` : 'Not provided'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Organization / Group</span>
          <span class="meta-value">${cleanOrg}</span>
        </div>
      </div>

      <div class="message-block">
        <div class="message-label">Subject: ${cleanSubject}</div>
        <div class="message-content">${cleanMessage}</div>
      </div>

      <div style="text-align: center; margin-top: 20px;">
        <a href="mailto:${cleanEmail}?subject=Re:%20${encodeURIComponent(subject)}" class="reply-btn">Reply to ${cleanName}</a>
      </div>
    </div>
    <div class="footer">
      This notification was dispatched via Resend from HURIZA Financial Intelligence.<br />
      Direct contact line: <strong>0782557168</strong> (+250 782 557 168) &bull; Kigali, Rwanda.
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
New HURIZA Contact Submission
---------------------------------------
Date: ${dateStr} (CAT Kigali)
From: ${name} (${email})
Phone: ${phone || 'Not provided'}
Organization: ${organization || 'Individual / None'}
Subject: ${subject}

Message:
${message}

---------------------------------------
Direct Hotline: 0782557168 (+250 782 557 168)
Reply directly to: ${email}
    `.trim();

    const { data: resendData, error: resendError } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: email,
      subject: `[HURIZA Contact] ${subject} - from ${name}`,
      html,
      text,
    });

    if (resendError) {
      console.error('Resend dispatch error:', resendError);
      return NextResponse.json(
        { error: resendError.message || 'Failed to dispatch email via Resend.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: resendData?.id,
      message: 'Your message has been received! We will get back to you shortly.',
    });
  } catch (err: unknown) {
    console.error('Contact API error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
