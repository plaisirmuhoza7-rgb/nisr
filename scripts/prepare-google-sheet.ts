import {loadEnvConfig} from '@next/env';
import {randomInt} from 'node:crypto';
import {parseArgs} from 'node:util';
import {GoogleAuth} from 'google-auth-library';
import {MANAGED_SNAPSHOT_MARKER, MANAGED_SNAPSHOT_PROVENANCE, MANAGED_SNAPSHOT_VERSION} from '../src/server/sheets/snapshot';

loadEnvConfig(process.cwd());

async function main() {
  const {values} = parseArgs({options: {spreadsheet: {type: 'string'}}, strict: true});
  const id = values.spreadsheet?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id || !/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new Error('Configure a valid spreadsheet ID.');
  const client = await new GoogleAuth({scopes: ['https://www.googleapis.com/auth/spreadsheets']}).getClient();
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`;
  const {data} = await client.request<{sheets?: {properties: {sheetId: number; title: string}}[]}>({url: `${base}?fields=sheets(properties(sheetId,title))`, timeout: 10000, retry: false});
  const sheets = data.sheets ?? [];
  if (sheets.some(sheet => sheet.properties.title === 'HURIZA data')) {
    const range = encodeURIComponent("'HURIZA data'!A1:B1");
    const marker = await client.request<{values?: unknown[][]}>({url: `${base}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`, timeout: 10000, retry: false});
    if (marker.data.values?.[0]?.[0] !== MANAGED_SNAPSHOT_MARKER || marker.data.values?.[0]?.[1] !== MANAGED_SNAPSHOT_VERSION) {
      throw new Error('A tab named HURIZA data already exists without the expected marker; it was not changed.');
    }
    console.log('The HURIZA data tab is already prepared.');
    return;
  }
  let sheetId: number;
  do {sheetId = randomInt(100000000, 2000000000);} while (sheets.some(sheet => sheet.properties.sheetId === sheetId));
  await client.request({url: `${base}:batchUpdate`, method: 'POST', timeout: 10000, retry: false, data: {requests: [
    {addSheet: {properties: {sheetId, title: 'HURIZA data', gridProperties: {rowCount: 2000, columnCount: 10}}}},
    {updateCells: {start: {sheetId, rowIndex: 0, columnIndex: 0}, rows: [
      {values: [{userEnteredValue: {stringValue: MANAGED_SNAPSHOT_MARKER}}, {userEnteredValue: {numberValue: MANAGED_SNAPSHOT_VERSION}}]},
      {values: [{userEnteredValue: {stringValue: MANAGED_SNAPSHOT_PROVENANCE}}]},
    ], fields: 'userEnteredValue'}},
  ]}});
  console.log('Created the dedicated HURIZA data tab. No account or financial records were sent.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error && (/^Configure a valid spreadsheet ID\.|^A tab named HURIZA data/.test(error.message))
    ? error.message : 'Could not prepare the Google Sheet. Check the API, service account access, and network.';
  console.error(message);
  process.exitCode = 1;
});
