import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import type {SheetCell, SheetRangeUpdate} from './validation';

export const DEMO_MASTER_MARKER = 'HURIZA_DEMO_MASTER';
export const DEMO_MASTER_VERSION = 1;
export const DEMO_MASTER_RANGE = "'HURIZA master'!A1:E47";
export const DEMO_MASTER_MAX_CHUNK_CHARS = 40_000;
export const DEMO_MASTER_MAX_REQUEST_BYTES = 1_800_000;
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const MAX_CHUNKS = 45;
const COLUMNS = 5;
const REVISION_PATTERN = /^(0|[1-9][0-9]*)$/;

export type DemoMasterSlot = 'A' | 'B';
export type DemoEnvelopeInput = {
  slot: DemoMasterSlot;
  revision: string;
  payload: string;
  key: Buffer;
  /** Optional only for deterministic tests. Production callers should omit it. */
  nonce?: Buffer;
};
export type DecodedDemoEnvelope = {slot: DemoMasterSlot; revision: string; payload: string};

function validateKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new TypeError(`Demo master encryption key must be a ${KEY_BYTES}-byte Buffer.`);
  }
}

function validateRevision(revision: string): bigint {
  if (typeof revision !== 'string' || !REVISION_PATTERN.test(revision)) {
    throw new TypeError('Demo master revision must be a nonnegative decimal string.');
  }
  return BigInt(revision);
}

function slotRange(slot: DemoMasterSlot): string {
  if (slot !== 'A' && slot !== 'B') throw new TypeError('Invalid demo master slot.');
  // Fixed, server-owned ranges in the dedicated private tab.
  return slot === 'A' ? "'HURIZA master'!A1:E47" : "'HURIZA master'!G1:K47";
}

function chunksOf(payload: string): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const codePoint of payload) {
    if (chunk.length + codePoint.length > DEMO_MASTER_MAX_CHUNK_CHARS) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += codePoint;
  }
  if (chunk.length || payload.length === 0) chunks.push(chunk);
  return chunks;
}

function associatedData(slot: DemoMasterSlot, revision: string): Buffer {
  return Buffer.from([DEMO_MASTER_MARKER, DEMO_MASTER_VERSION, slot, revision].join('\n'), 'utf8');
}

/** Encode one complete slot replacement. Caller must write this whole fixed range atomically with RAW. */
export function encodeDemoEnvelope(input: DemoEnvelopeInput): SheetRangeUpdate {
  if (!input || typeof input !== 'object') throw new TypeError('A demo master envelope is required.');
  validateKey(input.key);
  validateRevision(input.revision);
  if (input.slot !== 'A' && input.slot !== 'B') throw new TypeError('Invalid demo master slot.');
  if (typeof input.payload !== 'string') throw new TypeError('Demo master payload must be a string.');

  if (input.nonce !== undefined && (!Buffer.isBuffer(input.nonce) || input.nonce.length !== NONCE_BYTES)) {
    throw new TypeError(`Demo master nonce must be ${NONCE_BYTES} bytes.`);
  }
  const nonce = input.nonce ?? randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', input.key, nonce);
  cipher.setAAD(associatedData(input.slot, input.revision));
  const ciphertext = Buffer.concat([cipher.update(input.payload, 'utf8'), cipher.final()]);
  const chunks = chunksOf(ciphertext.toString('base64'));
  if (chunks.length > MAX_CHUNKS) throw new RangeError(`Demo master payload exceeds ${MAX_CHUNKS} chunks.`);

  const values: SheetCell[][] = [[DEMO_MASTER_MARKER, DEMO_MASTER_VERSION, input.slot, input.revision, nonce.toString('base64')]];
  values.push([cipher.getAuthTag().toString('base64'), chunks.length, ciphertext.length, '', '']);
  chunks.forEach((chunk, index) => values.push([DEMO_MASTER_MARKER, input.slot, index, chunks.length, chunk]));
  // Pad the fixed region so a smaller replacement erases cells from the prior generation.
  while (values.length < 2 + MAX_CHUNKS) values.push(['', '', '', '', '']);

  const range = slotRange(input.slot);
  const body = {valueInputOption: 'RAW', data: [{range, values}]};
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > DEMO_MASTER_MAX_REQUEST_BYTES) {
    throw new RangeError(`Demo master request must not exceed ${DEMO_MASTER_MAX_REQUEST_BYTES} bytes.`);
  }
  return {range, values};
}

/** Validate a complete read-back matrix and authenticate it before returning any payload. */
export function decodeDemoEnvelope(
  values: readonly (readonly unknown[])[],
  options: {slot: DemoMasterSlot; key: Buffer; minimumRevision?: string},
): DecodedDemoEnvelope {
  validateKey(options.key);
  const range = slotRange(options.slot);
  void range; // Validate the slot before examining data.
  if (options.minimumRevision !== undefined) validateRevision(options.minimumRevision);
  if (!Array.isArray(values) || values.length !== 2 + MAX_CHUNKS || values.some(row => !Array.isArray(row) || row.length !== COLUMNS)) {
    throw new Error('Malformed demo master snapshot dimensions.');
  }
  const [marker, version, slot, revision, nonceText] = values[0];
  const [tagText, count, ciphertextLength] = values[1];
  if (marker !== DEMO_MASTER_MARKER || version !== DEMO_MASTER_VERSION) throw new Error('Unknown demo master marker or version.');
  if (slot !== options.slot || typeof revision !== 'string') throw new Error('Demo master slot or revision mismatch.');
  const revisionValue = validateRevision(revision);
  if (options.minimumRevision !== undefined && revisionValue < BigInt(options.minimumRevision)) {
    throw new Error('Demo master revision is stale.');
  }
  if (typeof nonceText !== 'string' || typeof tagText !== 'string' || !Number.isSafeInteger(count) || (count as number) < 1 || (count as number) > MAX_CHUNKS ||
      !Number.isSafeInteger(ciphertextLength) || (ciphertextLength as number) < 0) {
    throw new Error('Malformed demo master integrity metadata.');
  }
  const nonce = Buffer.from(nonceText, 'base64');
  const tag = Buffer.from(tagText, 'base64');
  if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES || nonce.toString('base64') !== nonceText || tag.toString('base64') !== tagText) {
    throw new Error('Malformed demo master encryption metadata.');
  }

  const chunks: string[] = [];
  for (let index = 0; index < count; index++) {
    const [chunkMarker, chunkSlot, chunkIndex, chunkCount, chunk] = values[2 + index];
    if (chunkMarker !== DEMO_MASTER_MARKER || chunkSlot !== options.slot || chunkIndex !== index || chunkCount !== count ||
        typeof chunk !== 'string' || chunk.length > DEMO_MASTER_MAX_CHUNK_CHARS) {
      throw new Error('Demo master chunks are incomplete or out of order.');
    }
    chunks.push(chunk);
  }
  for (let index = 2 + count; index < values.length; index++) {
    if (values[index].some((cell: unknown) => cell !== '')) throw new Error('Unexpected data after demo master chunks.');
  }

  const ciphertextText = chunks.join('');
  const ciphertext = Buffer.from(ciphertextText, 'base64');
  if (ciphertext.toString('base64') !== ciphertextText || ciphertext.length !== ciphertextLength) {
    throw new Error('Demo master ciphertext is malformed or truncated.');
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', options.key, nonce);
    decipher.setAAD(associatedData(options.slot, revision));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const payload = plaintext.toString('utf8');
    if (!Buffer.from(payload, 'utf8').equals(plaintext)) throw new Error('Invalid UTF-8 payload.');
    return {slot: options.slot, revision, payload};
  } catch {
    throw new Error('Demo master authentication failed.');
  }
}
