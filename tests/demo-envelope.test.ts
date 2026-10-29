import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {
  DEMO_MASTER_MARKER,
  DEMO_MASTER_MAX_CHUNK_CHARS,
  DEMO_MASTER_MAX_REQUEST_BYTES,
  DEMO_MASTER_RANGE,
  DEMO_MASTER_VERSION,
  decodeDemoEnvelope,
  encodeDemoEnvelope,
} from '../src/server/sheets/demo-envelope';
import type {SheetCell} from '../src/server/sheets/validation';

const key = Buffer.alloc(32, 0x41);
const nonce = Buffer.alloc(12, 0x17);
const payload = JSON.stringify({name: 'Secret member', email: 'private@example.test', tokenHash: 'never-in-plaintext'});

function encoded(revision = '12') {
  return encodeDemoEnvelope({slot: 'A', revision, payload, key, nonce});
}

function copyValues(values: SheetCell[][]): SheetCell[][] {
  return values.map(row => [...row]);
}

test('encodes an encrypted complete snapshot into a fixed RAW range with two-slot support', () => {
  const result = encoded();
  assert.equal(result.range, DEMO_MASTER_RANGE);
  assert.equal(result.values.length, 47);
  assert.ok(result.values.every(row => row.length === 5));
  assert.deepEqual(result.values[0].slice(0, 4), [DEMO_MASTER_MARKER, DEMO_MASTER_VERSION, 'A', '12']);
  assert.equal(result.values[0].includes('Secret member'), false);
  assert.equal(result.values[0].includes(payload), false);
  assert.equal(result.values.some(row => row.includes('private@example.test')), false);
  assert.equal(result.values.some(row => row.includes('never-in-plaintext')), false);
  assert.equal(encodeDemoEnvelope({slot: 'B', revision: '13', payload, key, nonce}).range, "'HURIZA master'!G1:K47");
  assert.deepEqual(decodeDemoEnvelope(result.values, {slot: 'A', key, minimumRevision: '12'}), {slot: 'A', revision: '12', payload});
});

test('uses a fresh random nonce when omitted and authenticates the revision', () => {
  const first = encodeDemoEnvelope({slot: 'A', revision: '1', payload, key});
  const second = encodeDemoEnvelope({slot: 'A', revision: '1', payload, key});
  assert.notEqual(first.values[0][4], second.values[0][4]);
  assert.throws(() => decodeDemoEnvelope(encoded('12').values, {slot: 'A', key, minimumRevision: '13'}), /stale/);
  const changedRevision = copyValues(encoded().values);
  changedRevision[0][3] = '13';
  assert.throws(() => decodeDemoEnvelope(changedRevision, {slot: 'A', key}), /authentication failed/);
});

test('rejects wrong keys, altered ciphertext, reordered and truncated chunks, and unknown versions', () => {
  assert.throws(() => decodeDemoEnvelope(encoded().values, {slot: 'A', key: randomBytes(32)}), /authentication failed/);
  const changed = copyValues(encoded().values);
  const cell = changed[2][4] as string;
  changed[2][4] = `${cell[0] === 'A' ? 'B' : 'A'}${cell.slice(1)}`;
  assert.throws(() => decodeDemoEnvelope(changed, {slot: 'A', key}), /authentication failed|malformed|chunks/);

  const reordered = copyValues(encoded().values);
  [reordered[2], reordered[3]] = [reordered[3], reordered[2]];
  assert.throws(() => decodeDemoEnvelope(reordered, {slot: 'A', key}), /out of order/);

  const truncated = copyValues(encoded().values);
  truncated[2][4] = (truncated[2][4] as string).slice(1);
  assert.throws(() => decodeDemoEnvelope(truncated, {slot: 'A', key}), /malformed or truncated|authentication failed/);

  const unknown = copyValues(encoded().values);
  unknown[0][1] = 999;
  assert.throws(() => decodeDemoEnvelope(unknown, {slot: 'A', key}), /version/);
});

test('accepts Unicode without splitting a code point and rejects oversized payloads', () => {
  const unicode = '🙂'.repeat(DEMO_MASTER_MAX_CHUNK_CHARS / 2 + 1);
  const result = encodeDemoEnvelope({slot: 'B', revision: '0', payload: unicode, key, nonce});
  assert.deepEqual(decodeDemoEnvelope(result.values, {slot: 'B', key}), {slot: 'B', revision: '0', payload: unicode});
  assert.throws(() => encodeDemoEnvelope({slot: 'A', revision: '0', payload: 'x'.repeat(DEMO_MASTER_MAX_REQUEST_BYTES), key, nonce}), /chunks|request/);
});

test('rejects malformed revision, key and nonce inputs', () => {
  for (const revision of ['-1', '01', '1.5', '']) {
    assert.throws(() => encodeDemoEnvelope({slot: 'A', revision, payload, key, nonce}), /revision/);
  }
  assert.throws(() => encodeDemoEnvelope({slot: 'A', revision: '1', payload, key: Buffer.alloc(31), nonce}), /32-byte/);
  assert.throws(() => encodeDemoEnvelope({slot: 'A', revision: '1', payload, key, nonce: Buffer.alloc(11)}), /12 bytes/);
});
