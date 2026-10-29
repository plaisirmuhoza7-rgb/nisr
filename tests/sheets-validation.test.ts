import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSheetUpdates, type SheetRangeUpdate} from '../src/server/sheets/validation';

const oneCell = new Set(['Summary!A1']);
const rectangle = new Set(["'Member Data'!B2:C3"]);

test('accepts values whose dimensions exactly match the allowlisted range', () => {
  const updates: SheetRangeUpdate[] = [
    {range: 'Summary!A1', values: [['ready']]},
    {range: "'Member Data'!B2:C3", values: [[1, 2], [3, 4]]},
  ];
  assert.doesNotThrow(() => validateSheetUpdates(updates, new Set([...oneCell, ...rectangle])));
});

test('rejects too many rows or columns for an allowlisted single cell', () => {
  assert.throws(() => validateSheetUpdates([{range: 'Summary!A1', values: [['a'], ['b']]}], oneCell), /exactly fit/);
  assert.throws(() => validateSheetUpdates([{range: 'Summary!A1', values: [['a', 'b']]}], oneCell), /exactly fit/);
});

test('rejects undersized rectangular matrices and reversed range extents', () => {
  assert.throws(() => validateSheetUpdates([{range: "'Member Data'!B2:C3", values: [[1]]}], rectangle), /exactly fit/);
  assert.throws(() => validateSheetUpdates([{range: 'Summary!C3:A1', values: [[1]]}], new Set(['Summary!C3:A1'])), /after its start/);
});

test('rejects duplicate range updates in one batch', () => {
  assert.throws(() => validateSheetUpdates([
    {range: 'Summary!A1', values: [['first']]},
    {range: 'Summary!A1', values: [['second']]},
  ], oneCell), /not allowed/);
});

test('rejects malformed tabs, oversized ranges, and null cells that could leave stale data', () => {
  const malformed = "'Bad'Name'!A1";
  assert.throws(() => validateSheetUpdates([{range: malformed, values: [['x']]}], new Set([malformed])), /Invalid/);
  const oversized = 'Summary!A1:A10001';
  assert.throws(() => validateSheetUpdates([{range: oversized, values: [['x']]}], new Set([oversized])), /too large/);
  assert.throws(() => validateSheetUpdates([{range: 'Summary!A1', values: [[null as never]]}], oneCell), /strings, numbers, or booleans/);
});
