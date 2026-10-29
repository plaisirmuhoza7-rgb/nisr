import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MANAGED_SNAPSHOT_MARKER,
  MANAGED_SNAPSHOT_PROVENANCE,
  MANAGED_SNAPSHOT_RANGE,
  MANAGED_SNAPSHOT_VERSION,
  renderManagedSnapshot,
} from '../src/server/sheets/snapshot';

test('renders fixed destination, marker, version, provenance, and a full padded rectangle', () => {
  const result = renderManagedSnapshot([['Heading', 'Value'], ['Members', 12]]);
  assert.equal(result.range, "'HURIZA data'!A1:J2000");
  assert.equal(result.range, MANAGED_SNAPSHOT_RANGE);
  assert.equal(result.values.length, 2000);
  assert.ok(result.values.every(row => row.length === 10));
  assert.deepEqual(result.values[0], [MANAGED_SNAPSHOT_MARKER, MANAGED_SNAPSHOT_VERSION, '', '', '', '', '', '', '', '']);
  assert.deepEqual(result.values[1], [MANAGED_SNAPSHOT_PROVENANCE, '', '', '', '', '', '', '', '', '']);
  assert.deepEqual(result.values[2], ['Heading', 'Value', '', '', '', '', '', '', '', '']);
  assert.deepEqual(result.values[3], ['Members', 12, '', '', '', '', '', '', '', '']);
  assert.deepEqual(result.values[4], ['', '', '', '', '', '', '', '', '', '']);
});

test('pads shorter snapshots so formerly occupied cells are overwritten with empty strings', () => {
  const larger = renderManagedSnapshot([['old row'], ['another old row']]);
  assert.equal(larger.values[3][0], 'another old row');
  const smaller = renderManagedSnapshot([['current row']]);
  assert.equal(smaller.values[3][0], '');
  assert.ok(smaller.values.slice(3).every(row => row.every(cell => cell === '')));
});

test('preserves text literally, including formula-looking strings for RAW writing', () => {
  const formulaText = '=IMPORTXML("https://example.invalid", "//x")';
  assert.equal(renderManagedSnapshot([[formulaText]]).values[2][0], formulaText);
});

test('supports seven-column projections and rejects row or column overflow without truncation', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  assert.deepEqual(renderManagedSnapshot([seven]).values[2], [...seven, '', '', '']);
  assert.throws(() => renderManagedSnapshot(Array.from({length: 1999}, () => [])), /at most 1998/);
  assert.throws(() => renderManagedSnapshot([Array.from({length: 11}, () => 'x')]), /at most 10 cells/);
});

test('rejects unsafe, fractional, non-finite, and non-cell values', () => {
  for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
    assert.throws(() => renderManagedSnapshot([[value]]), /safe integers/);
  }
  assert.throws(() => renderManagedSnapshot([[null as never]]), /strings, booleans, or safe integers/);
  assert.throws(() => renderManagedSnapshot([[{} as never]]), /strings, booleans, or safe integers/);
});

test('rejects a rendered values payload larger than 1.8 MB', () => {
  const large = 'x'.repeat(50000);
  const rows = Array.from({length: 4}, () => Array.from({length: 10}, () => large));
  assert.throws(() => renderManagedSnapshot(rows), /must not exceed 1800000 serialized bytes/);
});
