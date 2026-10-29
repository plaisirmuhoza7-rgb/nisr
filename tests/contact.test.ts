import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/contact/route';

test('contact route rejects invalid JSON body', async () => {
  const req = new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json',
  });
  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'Invalid request body.');
});

test('contact route validates required fields and format', async () => {
  const req = new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'A', // too short
      email: 'not-an-email',
      subject: '',
      message: 'hi', // too short
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.length > 0);
});

test('contact route traps bots via honeypot field', async () => {
  const req = new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Spam Bot',
      email: 'spammer@example.com',
      subject: 'Cheap Rolex',
      message: 'Buy now and save 99%',
      hp: 'bot-filled-this',
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.message, 'Message received.');
});
