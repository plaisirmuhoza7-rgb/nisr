import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoMasterTransport, type MasterRequest} from '../src/server/sheets/demo-master-transport';

const spreadsheetId = 'abcdefghij_123';
const key = Buffer.alloc(32, 0x42);
const marker = 'HURIZA_ENCRYPTED_DEMO_MASTER_V1';

function fakeSheets(options: {withMarker?: boolean} = {}) {
  const grid: unknown[][] = Array.from({length: 47}, () => Array<unknown>(11).fill(''));
  if (options.withMarker !== false) grid[0][11] = marker;

  const request: MasterRequest = async ({url, method, data}) => {
    const valuesPath = url.split('/values/')[1];
    if (method === 'POST' && url.endsWith('/values:batchUpdate')) {
      const body = data as {data: {range: string; values: unknown[][]}[]};
      for (const update of body.data) {
        const start = update.range.includes('G1:K47') ? 6 : 0;
        for (let row = 0; row < update.values.length; row++) {
          for (let col = 0; col < update.values[row].length; col++) {
            grid[row][start + col] = update.values[row][col];
          }
        }
      }
      return {};
    }
    const range = decodeURIComponent((valuesPath ?? '').split('?')[0]);
    if (range === "'HURIZA master'!L1") return {values: options.withMarker === false ? [] : [[marker]]};
    if (range === "'HURIZA master'!A1:K47") return {values: grid.map(row => [...row])};
    throw new Error(`Unexpected fake Sheets request: ${url}`);
  };

  return {transport: createDemoMasterTransport(spreadsheetId, key, request), grid};
}

test('writes alternating encrypted slots and reads the newest authenticated snapshot', async () => {
  const {transport} = fakeSheets();
  await transport.write('A', '1', JSON.stringify({generation: 'first'}));
  assert.deepEqual(await transport.read(), {slot: 'A', revision: '1', payload: '{"generation":"first"}'});

  await transport.write('B', '2', JSON.stringify({generation: 'second'}));
  assert.deepEqual(await transport.read(), {slot: 'B', revision: '2', payload: '{"generation":"second"}'});

  await transport.write('A', '3', JSON.stringify({generation: 'third'}));
  assert.deepEqual(await transport.read(), {slot: 'A', revision: '3', payload: '{"generation":"third"}'});
});

test('rejects a master tab without the HURIZA ownership marker', async () => {
  const {transport} = fakeSheets({withMarker: false});
  await assert.rejects(transport.read(), /missing or not owned by HURIZA/);
});

test('rejects tampered encrypted slot data', async () => {
  const {transport, grid} = fakeSheets();
  await transport.write('A', '1', '{"secret":"snapshot"}');
  const chunk = grid[2][4] as string;
  grid[2][4] = `${chunk[0] === 'A' ? 'B' : 'A'}${chunk.slice(1)}`;
  await assert.rejects(transport.read(), /authentication failed|malformed|chunks/);
});

test('rejects inconsistent generations across the two slots', async () => {
  const {transport} = fakeSheets();
  await transport.write('A', '1', '{"generation":1}');
  await transport.write('B', '3', '{"generation":3}');
  await assert.rejects(transport.read(), /generations are inconsistent/);
});
